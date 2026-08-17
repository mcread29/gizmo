import type { SessionOptions } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import type { AgentClient, AgentEventListener } from './AgentClient';
import { AgentStore } from './AgentStore.svelte';

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
});
