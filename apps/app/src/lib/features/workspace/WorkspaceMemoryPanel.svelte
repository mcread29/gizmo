<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote, SettingField } from '../../components';
	import ConfigureSectionHeading from './configure/ConfigureSectionHeading.svelte';
	import MemoryDigestList from './memory/MemoryDigestList.svelte';
	import MemoryDigestOverrides from './memory/MemoryDigestOverrides.svelte';
	import MemoryFactList from './memory/MemoryFactList.svelte';
	import { WorkspaceMemory } from './memory/workspace-memory.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		/** Overview lists what this workspace overrides; a write here changes it. */
		onOverrideChange?: () => void;
	}

	let { store, workspacePath, onOverrideChange }: Props = $props();

	const memory = new WorkspaceMemory();
	memory.onOverrideChange = () => onOverrideChange?.();

	$effect(() => memory.load(store, workspacePath));

	/*
	 * A read attempted while the socket was down leaves the tab empty, and
	 * nothing else would ask again. Reconnecting asks once more, without
	 * resetting the filter the way a reload would.
	 */
	$effect(() => {
		if (store.connection === 'connected' && !memory.status)
			void memory.refresh();
	});

	$effect(() => {
		if (!memory.status?.running) return;
		const timer = setInterval(() => void memory.refresh(), 1500);
		return () => clearInterval(timer);
	});

	let status = $derived(memory.status);
	let models = $derived(store.availableModels);
	let coverage = $derived(
		status && status.segments > 0
			? Math.round((status.digested / status.segments) * 100)
			: 0,
	);
	let undigested = $derived(
		status ? Math.max(0, status.segments - status.digested) : 0,
	);
</script>

<ConfigureSectionHeading
	title="Memory"
	description={`${status ? `${status.digested} of ${status.segments} segments digested. ` : ''}Memory is derived from this workspace's journal. Digesting follows Settings → Memory until this workspace overrides it.`}
/>

{#if memory.error}
	<ResourceNote tone="error">{memory.error}</ResourceNote>
{/if}

<MemoryDigestOverrides {memory} {models} />

<div data-ui="settings-card">
	<SettingField label="Coverage" stacked>
		{#snippet detail()}
			{#if status?.running}
				{status.running.phase === 'facts' ? 'Deriving facts from' : 'Digesting'}
				{status.running.done} of {status.running.total}
				{#if status.running.failed > 0}
					· {status.running.failed} failed
				{/if}
				{#if status.running.error}
					<span data-ui="memory-error">{status.running.error}</span>
				{/if}
			{:else if undigested > 0}
				{undigested} segment{undigested === 1 ? '' : 's'} not yet digested.
			{:else if status && status.segments > 0}
				Every segment has a digest.
			{:else}
				No journal segments yet.
			{/if}
		{/snippet}
		<progress value={coverage} max="100" aria-label="Digest coverage"
		></progress>
	</SettingField>

	<div data-ui="setting-actions">
		{#if status?.running}
			<Button variant="secondary" onclick={() => void memory.stop()}
				>Stop</Button
			>
		{:else}
			<Button
				disabled={memory.busy || !status?.settings.model || undigested === 0}
				onclick={() => void memory.backfill(false)}
			>
				Digest {undigested} segment{undigested === 1 ? '' : 's'}
			</Button>
			<Button
				variant="secondary"
				disabled={memory.busy || !status?.settings.model || !status?.segments}
				onclick={() => void memory.backfill(true)}
			>
				Rebuild all
			</Button>
		{/if}
	</div>
</div>

<div data-ui="settings-card">
	<div data-ui="settings-section-header">
		<h3>What is currently true</h3>
		<span>
			Statements the project still stands behind, derived from the digests. A
			later session that contradicts one retires it, so this list shrinks as
			well as grows.
		</span>
	</div>

	<MemoryFactList facts={memory.facts} />
</div>

<div data-ui="settings-card">
	<div data-ui="settings-section-header">
		<h3>Saved memories</h3>
		<span>What the agent recalls from this workspace, newest first.</span>
		<input
			type="search"
			placeholder="Filter decisions, summaries, errors"
			aria-label="Filter memories"
			value={memory.query}
			oninput={(event) => void memory.search(event.currentTarget.value)}
		/>
	</div>

	<MemoryDigestList digests={memory.digests} query={memory.query} />
</div>
