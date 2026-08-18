<script lang="ts">
	import { RotateCw, Terminal } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tabs } from '../../components';
	import { sourceHref } from './compiler-diagnostics';

	interface Props {
		store: AgentStore;
		projectPath?: string;
	}

	let { store, projectPath }: Props = $props();

	let level = $state('all');
	let viewport = $state<HTMLDivElement>();
	let following = true;

	let entries = $derived(
		level === 'all'
			? store.consoleEntries
			: store.consoleEntries.filter((entry) => entry.level === level),
	);

	onMount(() => void store.loadConsole());

	// Tail behaviour: keep pinned to the newest line unless the user scrolls up.
	$effect(() => {
		entries.length;
		if (!following || !viewport) return;
		void tick().then(() => {
			if (viewport) viewport.scrollTop = viewport.scrollHeight;
		});
	});

	function trackScroll() {
		if (!viewport) return;
		following =
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 24;
	}
</script>

<div data-ui="console-toolbar">
	<Tabs
		items={[
			{ value: 'all', label: 'All' },
			{ value: 'warn', label: 'Warnings' },
			{ value: 'error', label: 'Errors' },
		]}
		bind:value={level}
	>
		{#snippet children()}{/snippet}
	</Tabs>
	<Button
		variant="ghost"
		size="sm"
		aria-label="Reload console"
		disabled={store.consoleLoading}
		onclick={() => void store.loadConsole()}><RotateCw size={13} /></Button
	>
</div>

{#if entries.length === 0}
	<div data-ui="empty-state">
		<Terminal size={22} /><strong>Console is quiet</strong><span
			>{store.consoleLoading
				? 'Reading the Unity console…'
				: 'Editor output appears here as it happens.'}</span
		>
	</div>
{:else}
	<div
		data-ui="console-log"
		bind:this={viewport}
		onscroll={trackScroll}
		role="log"
		aria-label="Unity console"
	>
		{#each entries as entry, index (entry.seq ?? index)}
			<div data-ui="console-entry" data-level={entry.level}>
				<p>{entry.message}</p>
				{#if entry.file}
					<a
						data-ui="compiler-location"
						href={sourceHref(entry.file, projectPath, entry.line, entry.column)}
						>{entry.file}{entry.line ? `:${entry.line}` : ''}</a
					>
				{/if}
			</div>
		{/each}
	</div>
{/if}
