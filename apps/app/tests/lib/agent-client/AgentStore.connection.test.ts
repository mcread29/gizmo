import { describe, expect, it, vi } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';
import { InvalidEventClient } from './agent-store-invalid-client';
import { extensionUi } from '../../../src/lib/extensions/extension-ui.svelte.ts';

describe('AgentStore', () => {
	it('loads the extension UI catalog after connecting', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const listUi = vi.spyOn(client, 'listExtensionUi');
		const store = new AgentStore(client);

		await store.connect();
		// The catalog is fetched from an effect, which runs on a microtask.
		await Promise.resolve();

		expect(listUi).toHaveBeenCalled();
		expect(extensionUi.extensions.length).toBeGreaterThan(0);
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

	it('reconnects as soon as the page returns to the foreground', async () => {
		vi.useFakeTimers();
		try {
			const client = new FakeAgentClient({ latencyMs: 0 });
			const store = new AgentStore(client);
			await store.connect();
			client.dropConnection();
			expect(store.connection).toBe('disconnected');

			await store.wake();
			expect(store.connection).toBe('connected');
		} finally {
			vi.useRealTimers();
		}
	});

	it('leaves a deliberate disconnect alone when the page wakes', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		await store.disconnect();

		await store.wake();
		expect(store.connection).toBe('disconnected');
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
