import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';

describe('AgentStore', () => {
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
});
