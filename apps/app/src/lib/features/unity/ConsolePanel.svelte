<script lang="ts">
	import { Copy, RotateCw, Search, Terminal, Trash2 } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tabs, Tooltip } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import { sourceHref } from './compiler-diagnostics';
	import { consoleLine, matchesConsoleFilter } from './console-log';

	interface Props {
		store: AgentStore;
		projectPath?: string;
	}

	let { store, projectPath }: Props = $props();

	let level = $state('all');
	let filter = $state('');
	let viewport = $state<HTMLDivElement>();
	let following = true;

	let entries = $derived(
		store.consoleEntries.filter((entry) =>
			matchesConsoleFilter(entry, level, filter),
		),
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

	async function copyVisible() {
		if (!navigator.clipboard || entries.length === 0) return;
		await navigator.clipboard.writeText(entries.map(consoleLine).join('\n'));
		toasts.show(`Copied ${entries.length} console lines`);
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
	<div data-ui="console-actions">
		<Tooltip text="Reload from the Editor">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Reload console"
					disabled={store.consoleLoading}
					onclick={() => void store.loadConsole()}
					><RotateCw size={13} /></Button
				>
			{/snippet}
		</Tooltip>
		<Tooltip text="Copy the lines shown">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Copy console"
					disabled={entries.length === 0}
					onclick={() => void copyVisible()}><Copy size={13} /></Button
				>
			{/snippet}
		</Tooltip>
		<Tooltip text="Clear what is shown here, not the Editor console">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Clear console"
					disabled={store.consoleEntries.length === 0}
					onclick={() => store.clearConsole()}><Trash2 size={13} /></Button
				>
			{/snippet}
		</Tooltip>
	</div>
</div>

<div data-ui="console-filter">
	<Search size={13} />
	<label for="console-filter" data-ui="sr-only">Filter console</label>
	<input
		id="console-filter"
		bind:value={filter}
		type="search"
		placeholder="Filter"
		autocomplete="off"
	/>
</div>

{#if entries.length === 0}
	<div data-ui="empty-state">
		<Terminal size={22} /><strong>
			{store.consoleEntries.length ? 'Nothing matches' : 'Console is quiet'}
		</strong><span>
			{#if store.consoleEntries.length}
				No lines match the current filter.
			{:else if store.consoleLoading}
				Reading the Unity console…
			{:else}
				Editor output appears here as it happens.
			{/if}
		</span>
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
				<p>
					{#if entry.timestamp}<time data-ui="console-time"
							>{entry.timestamp}</time
						>{/if}{entry.message}
				</p>
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
