import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';
import { registerWebExtensions } from '../../../src/lib/extensions/registry.svelte.ts';

describe('AgentStore', () => {
	it('discovers projects and keeps per-session transcripts', async () => {
		registerWebExtensions([{ id: 'unity', hasProjectStatus: true }]);
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		const firstSession = store.sessionId!;

		expect(store.selectedProjectPath).toBe('/projects/ThirdPersonSandbox');
		expect(
			// Unity's opaque status payload, stored per extension id.
			store.projectStatuses.unity,
		).toMatchObject({ state: 'connected' });
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
});
