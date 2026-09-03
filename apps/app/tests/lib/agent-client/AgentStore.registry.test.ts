import { describe, expect, it, vi } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';

describe('AgentStore registry actions', () => {
	it('reloads extensions after a link so the change shows without a restart', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		const reload = vi.spyOn(store, 'reloadExtensions');

		await expect(store.registryLink('registry', 'codex')).resolves.toBe(true);

		expect(reload).toHaveBeenCalledTimes(1);
		expect(store.registryError).toBeUndefined();
	});

	it('keeps the registry result when the refresh itself fails', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		vi.spyOn(store, 'reloadExtensions').mockRejectedValue(new Error('boom'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(store.registryUnlink('registry', 'codex')).resolves.toBe(true);

		expect(store.registryError).toBeUndefined();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('does not refresh when the registry action fails', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		vi.spyOn(client, 'registryLink').mockRejectedValue(new Error('no such'));
		const reload = vi.spyOn(store, 'reloadExtensions');

		await expect(store.registryLink('registry', 'codex')).resolves.toBe(false);

		expect(reload).not.toHaveBeenCalled();
		expect(store.registryError).toBe('no such');
	});
});
