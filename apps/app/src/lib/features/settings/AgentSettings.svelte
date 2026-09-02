<script lang="ts">
	import { onMount } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import InstructionsEditor from './InstructionsEditor.svelte';
	import SettingsPage from './SettingsPage.svelte';
	import { toasts } from '../../toasts.svelte';

	let { store }: { store: AgentStore } = $props();

	// Always replace a workspace-scoped catalog with the global view on entry.
	onMount(() => {
		void store.refreshResources();
		void store.refreshToolPolicy();
	});

	let selectedInstruction = $state<'system-prompt' | 'global-agents'>(
		'system-prompt',
	);

	let catalog = $derived(store.resources);
	let prompts = $derived(catalog?.prompts ?? []);

	let policy = $derived(store.toolPolicy);
	/** Null global means Pi's default: every built-in enabled. */
	let selectedTools = $derived(policy ? (policy.global ?? policy.builtIn) : []);

	const toolLabels: Record<string, string> = {
		read: 'Read files',
		bash: 'Shell (bash)',
		powershell: 'Shell (PowerShell)',
		edit: 'Edit files',
		write: 'Write files',
		grep: 'Search content (grep)',
		find: 'Find files',
		ls: 'List directories',
	};

	function toggleTool(tool: string, checked: boolean) {
		if (!policy) return;
		const next = checked
			? [...selectedTools, tool]
			: selectedTools.filter((name) => name !== tool);
		void store.setGlobalToolPolicy(next);
	}

	function instructionsSaved() {
		toasts.show(
			'Saved. Takes effect for new threads or after Reload runtime.',
			'success',
		);
	}

	async function reloadRuntime() {
		if (await store.reloadRuntime()) {
			toasts.show(
				'Reloaded extensions, skills, prompts, and context',
				'success',
			);
		}
	}
</script>

<SettingsPage
	title="Agent resources"
	scope="Applies to every workspace on this machine"
	hideHeader
>
	{#snippet actions()}
		<Button
			variant="secondary"
			size="sm"
			disabled={store.resourcesLoading}
			onclick={() => void store.refreshResources()}
			>{store.resourcesLoading ? 'Refreshing…' : 'Refresh catalog'}</Button
		>
		<Button
			variant="secondary"
			size="sm"
			disabled={!store.sessionId ||
				store.runtimeReloading ||
				store.sessionState === 'streaming'}
			onclick={() => void reloadRuntime()}
			>{store.runtimeReloading ? 'Reloading…' : 'Reload runtime'}</Button
		>
	{/snippet}

	{#if store.resourceError}
		<ResourceNote tone="error">{store.resourceError}</ResourceNote>
	{/if}

	<div data-ui="instructions-workbench">
		<aside data-ui="instructions-library" aria-label="Instruction files">
			<span data-ui="instructions-library-label">Instructions</span>
			<button
				data-state={selectedInstruction === 'system-prompt'
					? 'active'
					: 'inactive'}
				onclick={() => (selectedInstruction = 'system-prompt')}
			>
				<strong>System prompt</strong>
				<span>Replaces Pi's default agent prompt.</span>
			</button>
			<button
				data-state={selectedInstruction === 'global-agents'
					? 'active'
					: 'inactive'}
				onclick={() => (selectedInstruction = 'global-agents')}
			>
				<strong>Global AGENTS.md</strong>
				<span>Guidance shared by every workspace.</span>
			</button>
		</aside>

		<div data-ui="instructions-editor-area">
			{#key selectedInstruction}
				<InstructionsEditor
					{store}
					target={selectedInstruction}
					title={selectedInstruction === 'system-prompt'
						? 'System prompt'
						: 'Global AGENTS.md'}
					description={selectedInstruction === 'system-prompt'
						? "Replaces Pi's default system prompt. Leave empty to use Pi's default; extension prompts still take precedence."
						: 'Instructions applied to every session on this machine.'}
					onSaved={instructionsSaved}
					workbench
				/>
			{/key}
		</div>
	</div>

	<div data-ui="settings-subhead">
		<strong>Built-in tools</strong>
		<span
			>What the agent may start threads with, stored as Pi's defaultTools
			setting. A workspace may override this in its Configure screen; takes
			effect for new threads or after Reload runtime.</span
		>
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
			<div data-ui="integration-list">
				{#each policy.builtIn as tool (tool)}
					<div data-ui="integration-row">
						<label>
							<input
								type="checkbox"
								checked={selectedTools.includes(tool)}
								disabled={store.toolPolicyLoading}
								onchange={(event) =>
									toggleTool(tool, event.currentTarget.checked)}
							/>
							<span>
								<strong>{toolLabels[tool] ?? tool}</strong>
								<small>{tool}</small>
							</span>
						</label>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div data-ui="settings-subhead">
		<strong>Prompts</strong>
		<span>Prompt templates available as commands. Edit these on disk.</span>
	</div>

	<div data-ui="settings-card">
		{#if prompts.length === 0}
			<ResourceNote>Nothing found.</ResourceNote>
		{:else}
			<div data-ui="resource-list">
				{#each prompts as resource (resource.id)}
					<div data-ui="resource-row">
						<strong>
							{resource.name}
							<em data-ui="resource-scope">{resource.scope}</em>
						</strong>
						{#if resource.description}<span>{resource.description}</span>{/if}
						<small title={resource.path}>{resource.path}</small>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if catalog?.diagnostics.length}
		<div data-ui="settings-card">
			<div data-ui="settings-section-header">
				<strong>Warnings</strong>
				<span>Reported while loading these resources.</span>
			</div>
			<div data-ui="resource-list">
				{#each catalog.diagnostics as diagnostic, index (index)}
					<div data-ui="resource-row"><span>{diagnostic}</span></div>
				{/each}
			</div>
		</div>
	{/if}
</SettingsPage>
