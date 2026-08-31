import { describe, expect, it, vi } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';
import { InvalidEventClient } from './agent-store-invalid-client';

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

	it('surfaces malformed transport events without breaking connection setup', async () => {
		const store = new AgentStore(new InvalidEventClient());
		await store.connect();

		expect(store.connection).toBe('connected');
		expect(store.error).toEqual({
			kind: 'agent',
			message: 'Invalid agent protocol event',
		});
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
