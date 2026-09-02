import type {
	ProjectDomains,
	StoredProject,
	WorkspaceDirectoryListing,
} from '@gizmo/protocol';
import { extension } from '../../extensions/registry.svelte';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

/** Extensions with a live project process, in enabled order. */
function statusExtensionIds(store: AgentStore): string[] {
	return store.enabledExtensionIds.filter(
		(id) => extension(id)?.hasProjectStatus,
	);
}

export class ProjectCapability {
	#statusRequests?: Map<string, Promise<void>>;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async refreshProjects() {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.projectsLoading = true;
		store.projectError = undefined;
		try {
			store.projects = await this.client.listProjects();
			if (
				!store.selectedProjectPath ||
				!store.projects.some(({ path }) => path === store.selectedProjectPath)
			) {
				store.selectedProjectPath = store.projects[0]?.path;
			}
			await this.refreshProjectStatus();
		} catch (error) {
			store.projectError = errorMessage(error);
		} finally {
			store.projectsLoading = false;
		}
	}

	refreshProjectStatus(): Promise<void> {
		const store = this.store;
		const ids = statusExtensionIds(store);
		if (
			store.connection !== 'connected' ||
			!store.selectedProjectPath ||
			!ids.length
		) {
			store.projectStatuses = {};
			store.statusLoading = {};
			return Promise.resolve();
		}
		const projectPath = store.selectedProjectPath;
		this.#statusRequests ??= new Map();
		const requests = this.#statusRequests;
		const promises = ids.map((extensionId) => {
			const key = `${projectPath}\n${extensionId}`;
			const pending = requests.get(key);
			if (pending) return pending;
			const promise = this.#loadProjectStatus(projectPath, extensionId).finally(
				() => {
					if (requests.get(key) === promise) requests.delete(key);
				},
			);
			requests.set(key, promise);
			return promise;
		});
		return Promise.all(promises).then(() => {});
	}

	async openProjectService(extensionId: string) {
		const store = this.store;
		if (!store.selectedProjectPath || store.projectOpening[extensionId]) {
			throw new Error('No workspace is selected');
		}
		store.projectOpening = { ...store.projectOpening, [extensionId]: true };
		try {
			// The opaque result belongs to the extension; the owning web
			// extension validates it and reports errors per extension.
			return await this.client.openProject(
				store.selectedProjectPath,
				extensionId,
			);
		} finally {
			store.projectOpening = { ...store.projectOpening, [extensionId]: false };
		}
	}

	detectProject(projectPath: string): Promise<ProjectDomains> {
		return this.client.detectProject(projectPath);
	}

	browseProjects(path?: string): Promise<WorkspaceDirectoryListing> {
		return this.client.browseProjects(path);
	}

	searchProjects(
		query: string,
		root?: string,
	): Promise<WorkspaceDirectoryListing> {
		return this.client.searchProjects(query, root);
	}

	async addProject(projectPath: string): Promise<StoredProject> {
		const project = await this.client.addProject(projectPath);
		this.store.projects = [
			project,
			...this.store.projects.filter(({ path }) => path !== project.path),
		];
		return project;
	}

	async reorderProjects(paths: string[]) {
		const previous = this.store.projects;
		// Optimistic: the row lands where it was dropped, then the server confirms.
		const rank = new Map(paths.map((path, index) => [path, index]));
		this.store.projects = [...previous].sort(
			(left, right) =>
				(rank.get(left.path) ?? Number.POSITIVE_INFINITY) -
				(rank.get(right.path) ?? Number.POSITIVE_INFINITY),
		);
		try {
			this.store.projects = await this.client.reorderProjects(paths);
		} catch (error) {
			this.store.projects = previous;
			throw error;
		}
	}

	async removeProject(projectPath: string) {
		await this.client.removeProject(projectPath);
		this.store.projects = this.store.projects.filter(
			({ path }) => path !== projectPath,
		);
	}

	async selectWorkspace(projectPath: string) {
		if (this.store.selectedProjectPath === projectPath) return;
		this.enterWorkspace(projectPath);
		await Promise.all([
			this.refreshProjectStatus(),
			this.store.refreshGitStatus(),
		]);
	}

	enterWorkspace(projectPath: string, enabledExtensionIds?: string[]) {
		const store = this.store;
		store.selectedProjectPath = projectPath;
		store.projectStatuses = {};
		store.projectServiceErrors = {};
		store.gitStatus = undefined;
		store.projectError = undefined;
		store.projectExtensions = [];
		store.gitLoading = true;
		store.statusLoading = {};
		store.messages = [];
		store.unsent = [];
		store.enabledExtensionIds =
			enabledExtensionIds ??
			store.projects
				.find(({ path }) => path === projectPath)
				?.integrations.map(({ id }) => id) ??
			[];
	}

	async watchSelectedProject() {
		const store = this.store;
		if (
			store.connection !== 'connected' ||
			!store.sessionId ||
			!store.selectedProjectPath
		) {
			store.projectStatuses = {};
			store.projectExtensions = [];
			return;
		}
		const statusExtensionIdsForProject = statusExtensionIds(store);
		await store.refreshGitStatus();
		if (!statusExtensionIdsForProject.length) {
			store.projectStatuses = {};
			await store.loadProjectExtensions();
			return;
		}
		const sessionId = store.sessionId;
		const projectPath = store.selectedProjectPath;
		store.projectExtensions = [];
		const results = await Promise.allSettled(
			statusExtensionIdsForProject.map((extensionId) =>
				this.client.watchProjectStatus(sessionId, projectPath, extensionId),
			),
		);
		if (
			store.sessionId !== sessionId ||
			store.selectedProjectPath !== projectPath
		) {
			return;
		}
		// Each extension's watch resolves or fails independently; one service
		// being unavailable must not hide another's status.
		for (const [index, result] of results.entries()) {
			const extensionId = statusExtensionIdsForProject[index];
			if (result.status === 'fulfilled') {
				store.projectStatuses = {
					...store.projectStatuses,
					[extensionId]: result.value,
				};
				if (extensionId in store.projectServiceErrors) {
					const remainingErrors = { ...store.projectServiceErrors };
					delete remainingErrors[extensionId];
					store.projectServiceErrors = remainingErrors;
				}
			} else {
				store.projectServiceErrors = {
					...store.projectServiceErrors,
					[extensionId]: errorMessage(result.reason),
				};
			}
		}
	}

	async #loadProjectStatus(projectPath: string, extensionId: string) {
		const store = this.store;
		store.statusLoading = { ...store.statusLoading, [extensionId]: true };
		try {
			const status = await this.client.getProjectStatus(
				projectPath,
				extensionId,
			);
			if (store.selectedProjectPath === projectPath) {
				store.projectStatuses = {
					...store.projectStatuses,
					[extensionId]: status,
				};
			}
		} catch (error) {
			if (store.selectedProjectPath === projectPath) {
				store.projectServiceErrors = {
					...store.projectServiceErrors,
					[extensionId]: errorMessage(error),
				};
			}
		} finally {
			if (store.selectedProjectPath === projectPath) {
				const loading = { ...store.statusLoading };
				delete loading[extensionId];
				store.statusLoading = loading;
			}
		}
	}
}
