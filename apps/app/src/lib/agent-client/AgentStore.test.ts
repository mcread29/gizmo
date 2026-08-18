import type {
	AgentModelCatalog,
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
	UnityOpenProjectResult,
	UnityStatus,
} from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
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
	async renameSession() {}
	async prompt() {}
	async steer() {}
	async abort() {}
	async deleteSession() {}
	async getModelCatalog(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
	}
	async selectModel(): Promise<AgentModelCatalog> {
		return { models: [], thinkingLevels: [] };
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
	it('surfaces malformed transport events without breaking connection setup', async () => {
		const store = new AgentStore(new InvalidEventClient());
		await store.connect();

		expect(store.connection).toBe('connected');
		expect(store.error).toBe('Invalid agent protocol event');
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
});
