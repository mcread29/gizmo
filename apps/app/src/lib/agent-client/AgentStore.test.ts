import type {
	SessionOptions,
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
	async createSession(_options?: SessionOptions) {
		this.#listener?.({ type: 'not-in-the-protocol' });
		return 'session-1';
	}
	async prompt() {}
	async steer() {}
	async abort() {}
	async deleteSession() {}
	async listProjects() {
		return [];
	}
	async getProjectStatus(): Promise<UnityStatus> {
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

		store.renameSession(firstSession, 'Editor inspection');
		expect(
			store.sessions.find((session) => session.id === firstSession)?.title,
		).toBe('Editor inspection');
		await store.deleteSession(firstSession);
		expect(store.sessions.some((session) => session.id === firstSession)).toBe(
			false,
		);
	});
});
