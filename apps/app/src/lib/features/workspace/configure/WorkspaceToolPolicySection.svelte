<script lang="ts">
	import type { AgentStore } from '../../../agent-client';
	import { Button, ResourceNote } from '../../../components';

	interface Props {
		store: AgentStore;
		workspacePath: string;
	}

	let { store, workspacePath }: Props = $props();

	let policy = $derived(store.toolPolicy);
	let overriddenTools = $derived(policy?.project ?? []);

	function toggleProjectTool(tool: string, checked: boolean) {
		if (!policy) return;
		const next = checked
			? [...overriddenTools, tool]
			: overriddenTools.filter((name) => name !== tool);
		void store.setProjectToolPolicy(workspacePath, next);
	}

	function inheritGlobalTools() {
		void store.setProjectToolPolicy(workspacePath, null);
	}

	function overrideGlobalTools() {
		if (!policy) return;
		void store.setProjectToolPolicy(
			workspacePath,
			policy.global ?? policy.effective,
		);
	}
</script>

<div data-ui="settings-subhead">
	<strong>Built-in tools</strong>
	<span>
		Overrides the global built-in tools for this workspace through
		.pi/settings.json.
	</span>
</div>
<div data-ui="settings-card">
	{#if store.toolPolicyError}
		<ResourceNote tone="error">{store.toolPolicyError}</ResourceNote>
	{/if}
	{#if !policy}
		<ResourceNote>
			{store.toolPolicyLoading ? 'Loading…' : 'Tool policy unavailable.'}
		</ResourceNote>
	{:else}
		<div data-ui="setting-field">
			<div>
				<strong>{policy.project ? 'Overridden' : 'Inheriting global'}</strong>
				<span>Global: {policy.global?.join(', ') ?? 'Pi defaults'}</span>
			</div>
			{#if policy.project}
				<Button size="sm" variant="ghost" onclick={inheritGlobalTools}
					>Revert to global</Button
				>
			{:else}
				<Button size="sm" variant="ghost" onclick={overrideGlobalTools}
					>Override</Button
				>
			{/if}
		</div>
		{#if policy.project && !policy.projectApplied}
			<ResourceNote tone="error">
				This workspace is not trusted, so Pi ignores this override.
			</ResourceNote>
		{/if}
		{#if policy.project}
			<div data-ui="integration-list">
				{#each policy.builtIn as tool (tool)}
					<div data-ui="integration-row">
						<label>
							<input
								type="checkbox"
								checked={overriddenTools.includes(tool)}
								disabled={store.toolPolicyLoading}
								onchange={(event) =>
									toggleProjectTool(tool, event.currentTarget.checked)}
							/>
							<span>
								<strong>{tool}</strong>
							</span>
						</label>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
