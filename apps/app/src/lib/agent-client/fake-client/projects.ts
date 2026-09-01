import type { ProjectConfig } from '@gizmo/protocol';
import { fakeDomains, fakeStatus } from './fixtures';
import type { FakeClientState } from './state';

export class FakeProjectCapability {
	constructor(private readonly state: FakeClientState) {}

	async list() {
		this.state.assertConnected();
		return this.state.projects;
	}

	async detect(projectPath: string) {
		this.state.assertProject(projectPath);
		return {
			domains: fakeDomains,
			config: this.config(projectPath),
		};
	}

	async browse(path = '/projects') {
		return {
			path,
			...(path !== '/' ? { parent: '/' } : {}),
			directories:
				path === '/projects'
					? this.state.projects.map((project) => ({
							name: project.title,
							path: project.path,
						}))
					: [],
		};
	}

	async search(query: string, root = '/projects') {
		const needle = query.trim().toLowerCase();
		return {
			path: root,
			directories: this.state.projects
				.filter((project) => project.title.toLowerCase().includes(needle))
				.map((project) => ({ name: project.title, path: project.path })),
		};
	}

	async add(projectPath: string) {
		const project = {
			title: projectPath.split('/').at(-1) ?? projectPath,
			path: projectPath,
			integrations: [],
			addedAt: Date.now(),
		};
		this.state.projects.splice(
			0,
			this.state.projects.length,
			project,
			...this.state.projects.filter(({ path }) => path !== projectPath),
		);
		return project;
	}

	async setGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		this.state.assertProject(projectPath);
		const overrides =
			this.state.gizmoOverrides.get(projectPath) ?? new Map<string, boolean>();
		if (enabled === null) overrides.delete(extensionId);
		else overrides.set(extensionId, enabled);
		this.state.gizmoOverrides.set(projectPath, overrides);
		this.syncIntegrations(projectPath);
		return this.config(projectPath);
	}

	async setPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		this.state.assertProject(projectPath);
		const overrides =
			this.state.piOverrides.get(projectPath) ?? new Map<string, boolean>();
		if (enabled === null) overrides.delete(extensionId);
		else overrides.set(extensionId, enabled);
		this.state.piOverrides.set(projectPath, overrides);
		return this.config(projectPath);
	}

	async remove(projectPath: string) {
		const index = this.state.projects.findIndex(
			({ path }) => path === projectPath,
		);
		if (index >= 0) this.state.projects.splice(index, 1);
	}

	async reorder(paths: string[]) {
		const rank = new Map(paths.map((path, index) => [path, index]));
		this.state.projects.sort(
			(left, right) =>
				(rank.get(left.path) ?? Number.POSITIVE_INFINITY) -
				(rank.get(right.path) ?? Number.POSITIVE_INFINITY),
		);
		return [...this.state.projects];
	}

	async status(projectPath: string, extensionId: string) {
		this.state.assertProject(projectPath);
		return fakeStatus(projectPath, this.state.editorOpen);
	}

	async watchStatus(
		sessionId: string,
		projectPath: string,
		extensionId: string,
	) {
		this.state.getSession(sessionId);
		this.state.assertProject(projectPath);
		this.state.watchedProject = { sessionId, projectPath };
		return fakeStatus(projectPath, this.state.editorOpen);
	}

	async open(projectPath: string, extensionId: string) {
		this.state.assertProject(projectPath);
		const alreadyOpen = this.state.editorOpen;
		this.state.editorOpen = true;
		if (this.state.watchedProject?.projectPath === projectPath) {
			this.state.emit({
				type: 'project.status.changed',
				sessionId: this.state.watchedProject.sessionId,
				projectPath,
				extensionId,
				status: fakeStatus(projectPath, true),
			});
		}
		return {
			state: alreadyOpen ? ('already_open' as const) : ('opened' as const),
			ok: true,
			command: ['unity', 'open', projectPath],
			exitCode: 0,
			durationMs: 1,
			data: null,
			errors: [],
			warnings: [],
			...(alreadyOpen ? { status: fakeStatus(projectPath, true) } : {}),
		};
	}

	async generateCommitMessage(sessionId: string, projectPath: string) {
		this.state.getSession(sessionId);
		this.state.assertProject(projectPath);
		await this.state.wait(new AbortController().signal);
		return 'Update player behavior';
	}

	config(projectPath: string): ProjectConfig {
		return {
			version: 1,
			...(this.state.gizmoOverrides.get(projectPath)?.size
				? {
						gizmoExtensions: [
							...this.state.gizmoOverrides.get(projectPath)!,
						].map(([id, enabled]) => ({ id, enabled })),
					}
				: {}),
			...(this.state.piOverrides.get(projectPath)?.size
				? {
						piExtensions: [...this.state.piOverrides.get(projectPath)!].map(
							([id, enabled]) => ({ id, enabled }),
						),
					}
				: {}),
		};
	}

	gizmoEnabled(projectPath: string, id: string) {
		const override = this.state.gizmoOverrides.get(projectPath)?.get(id);
		return override ?? !this.state.disabledGizmoGlobally.has(id);
	}

	syncIntegrations(projectPath: string) {
		const project = this.state.projects.find(
			({ path }) => path === projectPath,
		);
		if (!project) return;
		project.integrations = fakeDomains
			.filter(({ id }) => this.gizmoEnabled(projectPath, id))
			.map(({ id }) => ({ id, root: '.' }));
	}
}
