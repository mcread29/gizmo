import type {
	AgentModelCatalog,
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
	SessionTree,
	UnityOpenProjectResult,
	UnityStatus,
} from '@unity-agent/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentClient, AgentEventListener } from './AgentClient';
import { AgentStore } from './AgentStore.svelte';
import { FakeAgentClient } from './FakeAgentClient';

class InvalidEventClient implements AgentClient {
	#listener?: AgentEventListener;

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
	async compact() {}
	async steer() {}
	async abort() {}
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
	async readConsole() {
		return { entries: [], dropped: false };
	}
	async revertFile(_projectPath: string, file: string) {
		return { file, reverted: true };
	}
	async selectThinkingLevel(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
	}
	async listProjects() {
		return [];
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

describe('AgentStore', () => {
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
			projectPath: '/projects/RenderingPlayground',
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
});
