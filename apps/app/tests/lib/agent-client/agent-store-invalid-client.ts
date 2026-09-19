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
import type { DigestOverride, DigestSettings } from '@gizmo/protocol';
import type { ActionResult, ExtensionUi, View } from '@gizmo/extension-api';
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
	#listeners = new Set<AgentEventListener>();
	// The memory layer is not exercised by these connection/replay tests; the
	// stubs exist only to satisfy the interface.
	async memoryStatus() {
		return {
			segments: 0,
			digested: 0,
			facts: 0,
			factSegments: 0,
			settings: { auto: false },
			defaults: { auto: false },
			overridden: false,
		};
	}
	async memoryDigests() {
		return [];
	}

	async memoryFacts() {
		return [];
	}
	async setMemoryOverride(_projectPath: string, _override?: DigestOverride) {
		return { auto: true };
	}

	async setMemoryDefaults(settings: DigestSettings) {
		return settings;
	}
	async startMemoryBackfill() {
		return {
			segments: 0,
			digested: 0,
			facts: 0,
			factSegments: 0,
			settings: { auto: false },
			defaults: { auto: false },
			overridden: false,
		};
	}
	async stopMemoryBackfill() {
		return {
			segments: 0,
			digested: 0,
			facts: 0,
			factSegments: 0,
			settings: { auto: false },
			defaults: { auto: false },
			overridden: false,
		};
	}
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
		for (const listener of this.#listeners)
			listener({ type: 'not-in-the-protocol' });
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
		return this.#registry();
	}
	async registryUpdate(): Promise<RegistryStatus> {
		return this.#registry();
	}
	async registryLink(): Promise<RegistryStatus> {
		return this.#registry();
	}
	async registryUnlink(): Promise<RegistryStatus> {
		return this.#registry();
	}
	#registry(): RegistryStatus {
		return {
			home: '/registry',
			url: 'https://github.com/mcread29/gizmo-registry.git',
			extensions: [],
		};
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
	async listExtensionUi(): Promise<ExtensionUi[]> {
		return [];
	}
	async openExtensionView(): Promise<View | undefined> {
		return undefined;
	}
	async closeExtensionView(): Promise<void> {}
	async runExtensionViewAction(): Promise<ActionResult> {
		return { status: 'succeeded' };
	}
	async runExtensionCommand(): Promise<void> {}
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
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}
	subscribeDisconnect() {
		return () => {};
	}
}
