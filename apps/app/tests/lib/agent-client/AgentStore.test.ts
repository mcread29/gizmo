import {
	builtInAgentTools,
	protocolVersion,
	seededToolPolicy,
	type AgentEvent,
	type AgentModelCatalog,
	type GitCommitResult,
	type GitStatus,
	type ProjectConfig,
	type RegistryStatus,
	type ResourceCatalog,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type ToolPolicy,
	type UnityOpenProjectResult,
	type UnityStatus,
	type ProviderStatus,
} from '@gizmo/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
	AgentClient,
	AgentEventListener,
} from '../../../src/lib/agent-client/AgentClient';
import { registerWebExtensions } from '../../../src/lib/extensions/registry.svelte.ts';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';

const emptyCatalog: ResourceCatalog = {
	skills: [],
	agentsFiles: [],
	prompts: [],
	diagnostics: [],
};

type InnerAgentEvent = AgentEvent extends infer Event
	? Event extends AgentEvent
		? Omit<Event, 'protocolVersion' | 'eventId' | 'sessionId'>
		: never
	: never;

class InvalidEventClient implements AgentClient {
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
	async getProjectStatus(): Promise<UnityStatus> {
		throw new Error('No selected project');
	}
	async watchProjectStatus(): Promise<UnityStatus> {
		throw new Error('No selected project');
	}
	async openProject(): Promise<UnityOpenProjectResult> {
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

/**
 * Minimal client for testing mid-resume event sequencing: resumeSession for a
 * chosen session is gated until the test releases it, and events can be
 * emitted by hand with server-style envelope ids while the gate is closed.
 */
class GatedResumeClient extends InvalidEventClient {
	#listener?: AgentEventListener;
	#eventId = 0;
	#gate?: { id: string; promise: Promise<void>; release: () => void };

	snapshot: SessionSnapshot = {
		session: {
			id: 'session-a',
			title: 'First',
			createdAt: 0,
			lastActiveAt: 0,
			messageCount: 0,
		},
		messages: [],
	};
	#snapshots = new Map<string, SessionSnapshot>();

	/** Installs the snapshot resumeSession will return for a session. */
	setSnapshot(snapshot: SessionSnapshot): void {
		this.#snapshots.set(snapshot.session.id, snapshot);
	}

	snapshotFor(sessionId: string): SessionSnapshot {
		return this.#snapshots.get(sessionId) ?? this.snapshot;
	}

	/** Signals the store to buffer; returns the cutoff setter + release. */
	gate(id: string): { release(): void } {
		let release!: () => void;
		const promise = new Promise<void>((resolve) => (release = resolve));
		this.#gate = { id, promise, release };
		return { release };
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const snapshot = this.#snapshots.get(sessionId) ?? this.snapshot;
		if (this.#gate?.id !== sessionId) return snapshot;
		const gate = this.#gate;
		this.#gate = undefined;
		await gate.promise;
		return snapshot;
	}

	emit(sessionId: string, event: InnerAgentEvent): void {
		this.#listener?.({
			...event,
			sessionId,
			protocolVersion,
			eventId: ++this.#eventId,
		} as AgentEvent);
	}

	/** The event id the next emit will carry, for setting the cutoff. */
	get nextEventId(): number {
		return this.#eventId + 1;
	}

	async connect() {}
	async disconnect() {}
	async listProviders(): Promise<ProviderStatus[]> {
		return [];
	}
	async reimportPiAuth(): Promise<ProviderStatus[]> {
		return [];
	}
	async listSessions(): Promise<SessionCatalog> {
		const sessions = [
			this.snapshot.session,
			...[...this.#snapshots.values()]
				.map(({ session }) => session)
				.filter(({ id }) => id !== this.snapshot.session.id),
		];
		return { sessions };
	}
	async createSession() {
		return 'session-a';
	}
	subscribe(listener: AgentEventListener) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}
}

describe('AgentStore', () => {
	it('loads runtime web extensions after connecting', async () => {
		const client = new FakeAgentClient({
			latencyMs: 0,
			webExtensionBundles: { bundles: [], diagnostics: [] },
		});
		const listBundles = vi.spyOn(client, 'listWebExtensionBundles');
		const store = new AgentStore(client);

		await store.connect();

		expect(listBundles).toHaveBeenCalledOnce();
	});

	it('reloads extension activation without replacing the running session', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		const sessionId = store.sessionId;

		await expect(store.reloadExtensions()).resolves.toEqual([]);

		expect(store.sessionId).toBe(sessionId);
		expect(store.connection).toBe('connected');
	});

	it('surfaces an Editor launch failure', async () => {
		const client = new FakeAgentClient({ latencyMs: 0, editorOpen: false });
		vi.spyOn(client, 'openProject').mockResolvedValue({
			state: 'error',
			ok: false,
			command: ['unity', 'open', '/projects/ThirdPersonSandbox'],
			exitCode: 0,
			durationMs: 1,
			data: null,
			errors: [
				{
					code: 'UNITY_CLI_INVALID_JSON',
					message: 'Editor exited with code 1',
				},
			],
			warnings: [],
		});
		const store = new AgentStore(client);
		await store.connect();

		await store.openSelectedProject();

		expect(store.projectError).toBe('Editor exited with code 1');
		expect(store.projectOpening).toBe(false);
	});

	it('surfaces malformed transport events without breaking connection setup', async () => {
		const store = new AgentStore(new InvalidEventClient());
		await store.connect();

		expect(store.connection).toBe('connected');
		expect(store.error).toEqual({
			kind: 'agent',
			message: 'Invalid agent protocol event',
		});
	});

	it('discovers projects and keeps per-session transcripts', async () => {
		registerWebExtensions([{ id: 'unity', hasProjectStatus: true }]);
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		const firstSession = store.sessionId!;

		expect(store.selectedProjectPath).toBe('/projects/ThirdPersonSandbox');
		expect(store.projectStatus?.state).toBe('connected');
		await store.prompt('Inspect the Editor');
		expect(store.sessions[0]?.title).toBe('Inspect the Editor');
		expect(store.messages.length).toBeGreaterThan(0);

		await store.newSession();
		expect(store.sessionId).not.toBe(firstSession);
		expect(store.messages).toEqual([]);

		await store.switchSession(firstSession);
		expect(store.messages.length).toBeGreaterThan(0);

		await store.renameSession(firstSession, 'Editor inspection');
		expect(
			store.sessions.find((session) => session.id === firstSession)?.title,
		).toBe('Editor inspection');
		await store.deleteSession(firstSession);
		expect(store.sessions.some((session) => session.id === firstSession)).toBe(
			false,
		);
	});

	it('reloads the active sidebar when its extension override changes', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();

		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			false,
		);
		expect(store.activeDomains).not.toContain('svelte');

		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			true,
		);
		expect(store.activeDomains).toContain('svelte');
	});

	it('updates the workspace integrations when switching threads', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			true,
		);
		const sandboxSession = store.sessionId!;

		await store.newSession('/projects/RenderingPlayground');
		expect(store.selectedProjectPath).toBe('/projects/RenderingPlayground');
		expect(store.activeDomains).not.toContain('svelte');

		await store.switchSession(sandboxSession);
		expect(store.selectedProjectPath).toBe('/projects/ThirdPersonSandbox');
		expect(store.activeDomains).toContain('svelte');
	});

	it('loads extensions for the active project', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const listExtensions = vi
			.spyOn(client, 'listProjectExtensions')
			.mockImplementation(async (projectPath) => ({
				extensions: [
					{
						id: projectPath,
						name: 'Extension',
						version: '1.0.0',
						apiVersion: 1,
						capabilities: [],
						operations: [],
					},
				],
			}));
		const store = new AgentStore(client);

		await store.connect();

		expect(listExtensions).toHaveBeenLastCalledWith(
			'/projects/ThirdPersonSandbox',
		);
		expect(store.projectExtensions[0]?.id).toBe('/projects/ThirdPersonSandbox');

		await store.newSession('/projects/RenderingPlayground');

		expect(listExtensions).toHaveBeenLastCalledWith(
			'/projects/RenderingPlayground',
		);
		expect(store.projectExtensions[0]?.id).toBe(
			'/projects/RenderingPlayground',
		);
	});

	it('restores the last session and transcript after reconnecting', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const firstStore = new AgentStore(client);
		await firstStore.connect();
		await firstStore.prompt('Remember this scene');
		const sessionId = firstStore.sessionId;
		await firstStore.disconnect();

		const restartedStore = new AgentStore(client);
		await restartedStore.connect();

		expect(restartedStore.sessionId).toBe(sessionId);
		expect(restartedStore.selectedProjectPath).toBe(
			'/projects/ThirdPersonSandbox',
		);
		expect(restartedStore.messages[0]).toMatchObject({
			role: 'user',
			content: 'Remember this scene',
		});
	});

	it('reads a background thread without changing the active thread', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		const backgroundId = store.sessionId!;
		await store.prompt('Background transcript');
		await store.newSession('/projects/RenderingPlayground');
		const activeId = store.sessionId!;

		const snapshot = await store.readSession(backgroundId);

		expect(snapshot.messages[0]?.content).toBe('Background transcript');
		expect(store.sessionId).toBe(activeId);
		expect((await client.listSessions()).lastSessionId).toBe(activeId);
	});

	it('runs independent sessions concurrently', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 20 }));
		await store.connect();
		const firstId = store.sessionId!;
		const firstPrompt = store.prompt('Work on the first task');
		expect(store.isSessionStreaming(firstId)).toBe(true);

		await store.newSession('/projects/RenderingPlayground');
		const secondId = store.sessionId!;
		const secondPrompt = store.prompt('Work on the second task');

		expect(secondId).not.toBe(firstId);
		expect(store.isSessionStreaming(firstId)).toBe(true);
		expect(store.isSessionStreaming(secondId)).toBe(true);
		await Promise.all([firstPrompt, secondPrompt]);
		expect(store.isSessionStreaming(firstId)).toBe(false);
		expect(store.isSessionStreaming(secondId)).toBe(false);

		await store.switchSession(firstId);
		expect(store.messages[0]?.content).toBe('Work on the first task');
	});

	it('creates workspace-bound threads and changes the live Pi model settings', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();

		await store.newSession('/projects/RenderingPlayground');
		expect(store.sessions[0]).toMatchObject({
			workspacePath: '/projects/RenderingPlayground',
		});

		await store.selectModel('openai-codex', 'gpt-5.6-terra');
		expect(store.model).toMatchObject({
			provider: 'openai-codex',
			id: 'gpt-5.6-terra',
		});

		await store.selectThinkingLevel('medium');
		expect(store.model?.thinkingLevel).toBe('medium');
	});

	it('reconnects on its own after the server drops the connection', async () => {
		vi.useFakeTimers();
		try {
			const client = new FakeAgentClient({ latencyMs: 0 });
			const store = new AgentStore(client);
			await store.connect();
			const sessionId = store.sessionId;
			expect(store.connection).toBe('connected');

			client.dropConnection();
			expect(store.connection).toBe('disconnected');
			expect(store.error).toEqual({
				kind: 'connection',
				message: 'Agent connection closed',
			});

			await vi.advanceTimersByTimeAsync(600);
			expect(store.connection).toBe('connected');
			// The reconnect lands back on the thread the user was reading.
			expect(store.sessionId).toBe(sessionId);
			expect(store.error).toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});

	it('retries immediately when asked, without waiting out the backoff', async () => {
		vi.useFakeTimers();
		try {
			const client = new FakeAgentClient({ latencyMs: 0 });
			const store = new AgentStore(client);
			await store.connect();
			client.dropConnection();

			await store.reconnectNow();
			expect(store.connection).toBe('connected');
			expect(store.reconnectAttempt).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('stops reconnecting once the client disconnects deliberately', async () => {
		vi.useFakeTimers();
		try {
			const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
			await store.connect();
			await store.disconnect();

			await vi.advanceTimersByTimeAsync(60_000);
			expect(store.connection).toBe('disconnected');
		} finally {
			vi.useRealTimers();
		}
	});

	it('resolves skill state globally and per workspace', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		const workspace = '/projects/ThirdPersonSandbox';

		await store.refreshResources();
		expect(
			store.resources?.skills.map(({ id, enabled }) => [id, enabled]),
		).toEqual([
			['global/svelte-code-writer', true],
			['global/unity-shader-review', false],
			['project/release-checklist', false],
		]);

		// A workspace override wins over the global default, in both directions.
		await store.refreshResources(workspace);
		await store.setProjectSkill(workspace, 'global/svelte-code-writer', false);
		await store.setProjectSkill(workspace, 'project/release-checklist', true);
		expect(
			store.resources?.skills.map(({ id, enabled }) => [id, enabled]),
		).toEqual([
			['global/svelte-code-writer', false],
			['global/unity-shader-review', false],
			['project/release-checklist', true],
		]);

		// Clearing the override falls back to the global setting again.
		await store.setProjectSkill(workspace, 'global/svelte-code-writer', null);
		expect(store.resources?.skills[0]).toMatchObject({ enabled: true });

		// Uninstalling removes it everywhere, whatever the workspace asked for.
		await store.setGlobalSkill(
			'project/release-checklist',
			{ installed: false },
			workspace,
		);
		expect(store.resources?.skills[2]).toMatchObject({
			installed: false,
			enabled: false,
		});
	});

	it('replays mid-resume stream events exactly once when switching threads', async () => {
		const client = new GatedResumeClient();
		client.setSnapshot({
			session: {
				id: 'session-b',
				title: 'Second',
				createdAt: 0,
				lastActiveAt: 0,
				messageCount: 1,
			},
			// The server splices the in-flight partial message into the snapshot;
			// its content reflects everything streamed up to the snapshot point.
			messages: [
				{
					id: 'm1',
					role: 'assistant',
					content: 'Hel',
					createdAt: 0,
					complete: false,
					tools: [],
				},
			],
		});
		const store = new AgentStore(client);
		await store.connect();
		expect(store.sessionId).toBe('session-a');

		// Resume of the other thread is held mid-flight; deltas stream in while
		// it is outstanding.
		const { release } = client.gate('session-b');
		const switching = store.switchSession('session-b');
		// These two events are already reflected in the snapshot that will
		// arrive (its lastEventId covers them); replaying them would duplicate.
		client.emit('session-b', {
			type: 'message.started',
			messageId: 'm1',
			role: 'assistant',
			createdAt: 0,
		});
		client.emit('session-b', {
			type: 'message.delta',
			messageId: 'm1',
			delta: 'Hel',
		});
		client.snapshotFor('session-b').lastEventId = client.nextEventId - 1;
		// This one streams after the snapshot point and must be applied once.
		client.emit('session-b', {
			type: 'message.delta',
			messageId: 'm1',
			delta: 'lo',
		});
		client.emit('session-b', { type: 'session.state', state: 'streaming' });
		release();
		await switching;

		// 'Hel' is not duplicated and 'lo' is not lost: the view converges.
		expect(store.messages).toHaveLength(1);
		expect(store.messages[0]?.content).toBe('Hello');
		expect(store.sessionState).toBe('streaming');
	});
});
