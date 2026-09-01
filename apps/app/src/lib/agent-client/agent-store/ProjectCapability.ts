import type {
	ProjectDomains,
	StoredProject,
	WorkspaceDirectoryListing,
} from '@gizmo/protocol';
import { extension } from '../../extensions/registry.svelte';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

export class ProjectCapability {
	#statusRequest?: { projectPath: string; promise: Promise<void> };

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

	refreshProjectStatus() {
		const store = this.store;
		if (
			store.connection !== 'connected' ||
			!store.selectedProjectPath ||
			!store.enabledExtensionIds.some((id) => extension(id)?.hasProjectStatus)
		) {
			store.projectStatus = undefined;
			store.statusLoading = false;
			return Promise.resolve();
		}
		const projectPath = store.selectedProjectPath;
		if (this.#statusRequest?.projectPath === projectPath) {
			return this.#statusRequest.promise;
		}
		const promise = this.#loadProjectStatus(projectPath).finally(() => {
			if (this.#statusRequest?.projectPath === projectPath) {
				this.#statusRequest = undefined;
			}
		});
		this.#statusRequest = { projectPath, promise };
		return promise;
	}

	async openSelectedProject() {
		const store = this.store;
		if (!store.selectedProjectPath || store.projectOpening) return;
		store.projectOpening = true;
		store.projectError = undefined;
		try {
			const result = await this.client.openProject(store.selectedProjectPath);
			if (!result.ok || result.state === 'error') {
				throw new Error(
					result.errors[0]?.message ??
						result.stderr ??
						'Unity Editor could not be opened.',
				);
			}
			await Promise.all([
				this.refreshProjectStatus(),
				store.loadProjectExtensions(),
			]);
		} catch (error) {
			store.projectError = errorMessage(error);
		} finally {
			store.projectOpening = false;
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
		store.projectStatus = undefined;
		store.gitStatus = undefined;
		store.projectError = undefined;
		store.projectExtensions = [];
		store.gitLoading = true;
		store.statusLoading = true;
		store.messages = [];
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
			store.projectStatus = undefined;
			store.projectExtensions = [];
			return;
		}
		await store.refreshGitStatus();
		if (
			!store.enabledExtensionIds.some((id) => extension(id)?.hasProjectStatus)
		) {
			store.projectStatus = undefined;
			await store.loadProjectExtensions();
			return;
		}
		const sessionId = store.sessionId;
		const projectPath = store.selectedProjectPath;
		store.projectExtensions = [];
		try {
			const [status] = await Promise.all([
				this.client.watchProjectStatus(sessionId, projectPath),
				store.loadProjectExtensions(),
			]);
			if (
				store.sessionId === sessionId &&
				store.selectedProjectPath === projectPath
			) {
				store.projectStatus = status;
				store.projectError = undefined;
			}
		} catch (error) {
			if (
				store.sessionId === sessionId &&
				store.selectedProjectPath === projectPath
			) {
				store.projectError = errorMessage(error);
			}
		}
	}

	async #loadProjectStatus(projectPath: string) {
		try {
			const status = await this.client.getProjectStatus(projectPath);
			if (this.store.selectedProjectPath === projectPath) {
				this.store.projectStatus = status;
				this.store.projectError = undefined;
			}
		} catch (error) {
			if (this.store.selectedProjectPath === projectPath) {
				this.store.projectError = errorMessage(error);
			}
		} finally {
			if (this.store.selectedProjectPath === projectPath) {
				this.store.statusLoading = false;
			}
		}
	}
}
