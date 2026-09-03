import {
	builtInAgentTools,
	seededToolPolicy,
	type AgentModelCatalog,
	type GitCommitResult,
	type GitStatus,
	type ProjectConfig,
	type ProviderStatus,
	type RegistryStatus,
	type ResourceCatalog,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type StoredProject,
	type ToolPolicy,
} from '@gizmo/protocol';
import type {
	AgentClient,
	AgentEventListener,
} from '../../../src/lib/agent-client/AgentClient';

const emptyCatalog: ResourceCatalog = {
	skills: [],
	agentsFiles: [],
	prompts: [],
	diagnostics: [],
};

export class InvalidEventClient implements AgentClient {
	#listener?: AgentEventListener;
	async listProviders(): Promise<ProviderStatus[]> {
		return [];
	}
	async reimportPiAuth(): Promise<ProviderStatus[]> {
		return [];
	}

	async connect() {}
	async disconnect() {}
	async listSessions(): Promise<SessionCatalog> {
		return { sessions: [] };
	}
	async createSession(_options?: SessionOptions) {
		this.#listener?.({ type: 'not-in-the-protocol' });
		return 'session-1';
	}
	async resumeSession(_sessionId: string): Promise<SessionSnapshot> {
		throw new Error('No session');
	}
	async readSession(_sessionId: string): Promise<SessionSnapshot> {
		throw new Error('No session');
	}
	async getSessionTree(_sessionId: string): Promise<SessionTree> {
		return { entries: [], leafId: null };
	}
	async branchSession(): Promise<SessionSnapshot> {
		throw new Error('No session');
	}
	async labelEntry(): Promise<SessionTree> {
		return { entries: [], leafId: null };
	}
	async renameSession() {}
	async prompt() {}
	async listCommands() {
		return [];
	}
	async compact() {}
	async reloadSession() {}
	async steer() {}
	async abort() {}
	async resolveExtensionUi() {}
	async registryStatus(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async registryAdd(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async registryUpdate(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async registryRemove(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async registryLink(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async registryUnlink(): Promise<RegistryStatus> {
		return { home: '/registry', registries: [] };
	}
	async resolveConfirmation() {}
	async deleteSession() {}
	async readAttachment(): Promise<{
		name: string;
		mimeType: string;
		data: string;
	}> {
		throw new Error('No attachment');
	}
	async revealAttachment() {}
	async getModelCatalog(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
	}
	async selectModel(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
	}
	async listProjectExtensions() {
		return { extensions: [] };
	}
	async invokeProjectExtension() {}
	async revertFile(_projectPath: string, file: string) {
		return { file, reverted: true };
	}
	async getGitStatus(): Promise<GitStatus> {
		throw new Error('No selected project');
	}
	async generateCommitMessage(): Promise<string> {
		throw new Error('No selected project');
	}
	async commitAll(): Promise<GitCommitResult> {
		throw new Error('No selected project');
	}
	async selectThinkingLevel(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
	}
	async listProjects() {
		// A thread cannot exist outside a workspace, so one must be known before
		// connect() will open the session this test inspects.
		return [
			{
				title: 'Sandbox',
				path: '/projects/Sandbox',
				integrations: [],
				addedAt: 0,
			},
		];
	}
	async detectProject() {
		return {
			domains: [{ id: 'svelte', name: 'Svelte', root: '.' }],
		};
	}
	async browseProjects() {
		return { path: '/projects', directories: [] };
	}
	async searchProjects() {
		return { path: '/projects', directories: [] };
	}
	async addProject(projectPath: string) {
		return {
			title: 'project',
			path: projectPath,
			integrations: [],
			addedAt: 0,
		};
	}
	async setProjectGizmoExtension(): Promise<ProjectConfig> {
		return { version: 1 };
	}
	async setProjectPiExtension(): Promise<ProjectConfig> {
		return { version: 1 };
	}
	async setGlobalGizmoExtension(): Promise<ResourceCatalog> {
		return emptyCatalog;
	}
	async removeProject() {}
	async reorderProjects(): Promise<StoredProject[]> {
		return [];
	}
	async listResources(): Promise<ResourceCatalog> {
		return emptyCatalog;
	}
	async setGlobalSkill(): Promise<ResourceCatalog> {
		return emptyCatalog;
	}
	async setProjectSkill(): Promise<ResourceCatalog> {
		return emptyCatalog;
	}
	async readSkill(path: string) {
		return { path, content: '' };
	}
	async writeSkill(path: string, content: string) {
		return { path, content };
	}
	readInstructions: AgentClient['readInstructions'] = async (target) => ({
		target,
		path: '/instructions.md',
		content: '',
		exists: false,
	});
	writeInstructions: AgentClient['writeInstructions'] = async (
		target,
		content,
	) => ({ target, path: '/instructions.md', content, exists: true });
	async setGlobalExtension(): Promise<ResourceCatalog> {
		return emptyCatalog;
	}
	async getToolPolicy(): Promise<ToolPolicy> {
		return {
			builtIn: [...builtInAgentTools],
			global: [...seededToolPolicy],
			project: null,
			effective: [...seededToolPolicy],
			projectApplied: false,
		};
	}
	async setGlobalToolPolicy(): Promise<ToolPolicy> {
		return this.getToolPolicy();
	}
	async setProjectToolPolicy(): Promise<ToolPolicy> {
		return this.getToolPolicy();
	}
	async getProjectStatus(): Promise<unknown> {
		throw new Error('No selected project');
	}
	async watchProjectStatus(): Promise<unknown> {
		throw new Error('No selected project');
	}
	async openProject(): Promise<unknown> {
		throw new Error('No selected project');
	}
	subscribe(listener: AgentEventListener) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}
	subscribeDisconnect() {
		return () => {};
	}
}
