<script lang="ts">
	import {
		createVirtualizer,
		observeElementRect,
	} from '@tanstack/svelte-virtual';
	import { Copy, RotateCw, Search, Terminal, Trash2 } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tabs, Tooltip } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import { sourceHref } from './compiler-diagnostics';
	import {
		consoleLine,
		consoleSourceLabel,
		consoleTimeLabel,
		matchesConsoleFilter,
	} from './console-log';

	interface Props {
		store: AgentStore;
		projectPath?: string;
	}

	let { store, projectPath }: Props = $props();

	let level = $state('all');
	let filter = $state('');
	let viewport = $state<HTMLDivElement | null>(null);
	let following = true;
	let rowKeys: Array<string | number> = [];

	let rows = $derived(
		store.consoleEntries
			.map((entry, index) => ({ entry, key: entry.seq ?? index }))
			.filter(({ entry }) => matchesConsoleFilter(entry, level, filter)),
	);
	let entries = $derived(rows.map(({ entry }) => entry));
	const initialViewport = { width: 240, height: 640 };
	const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		count: 0,
		getScrollElement: () => viewport,
		getItemKey: (index) => rowKeys[index] ?? index,
		estimateSize: () => 76,
		overscan: 5,
		initialRect: initialViewport,
		observeElementRect: (instance, notify) =>
			observeElementRect(instance, (rect) =>
				notify(rect.height > 0 ? rect : initialViewport),
			),
	});
	let virtualItems = $derived($virtualizer.getVirtualItems());

	onMount(() => void store.loadConsole());

	$effect(() => {
		rowKeys = rows.map((row) => row.key);
		get(virtualizer).setOptions({
			count: rows.length,
			getItemKey: (index) => rowKeys[index] ?? index,
		});
	});

	$effect(() => {
		const node = viewport;
		get(virtualizer).setOptions({ getScrollElement: () => node });
	});

	// Tail behaviour: keep pinned to the newest line unless the user scrolls up.
	$effect(() => {
		const count = rows.length;
		if (!following || !viewport) return;
		void tick().then(() => {
			if (!count) return;
			$virtualizer.scrollToIndex(count - 1, { align: 'end' });
			requestAnimationFrame(() => {
				if (following) {
					$virtualizer.scrollToIndex(count - 1, { align: 'end' });
				}
			});
		});
	});

	function trackScroll() {
		if (!viewport) return;
		following =
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64;
	}

	function measure(node: HTMLDivElement) {
		$virtualizer.measureElement(node);
	}

	async function copyVisible() {
		if (!navigator.clipboard || entries.length === 0) return;
		await navigator.clipboard.writeText(entries.map(consoleLine).join('\n'));
		toasts.show(`Copied ${entries.length} console lines`);
	}
</script>

<div data-ui="console-panel">
	<div data-ui="console-filter">
		<Search size={13} />
		<label for="console-filter" data-ui="sr-only">Filter console</label>
		<input
			id="console-filter"
			bind:value={filter}
			type="search"
			placeholder="Filter messages or files"
			autocomplete="off"
		/>
	</div>

	<div data-ui="console-toolbar">
		<Tabs
			variant="filter"
			items={[
				{ value: 'all', label: 'All', shortLabel: 'All' },
				{ value: 'warn', label: 'Warnings', shortLabel: 'Warn' },
				{ value: 'error', label: 'Errors', shortLabel: 'Error' },
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
			<div
				data-ui="console-canvas"
				style={`height:${$virtualizer.getTotalSize()}px`}
			>
				{#each virtualItems as row (row.key)}
					{@const entry = rows[row.index]!.entry}
					<div
						data-ui="console-row"
						data-index={row.index}
						use:measure
						style={`transform:translateY(${row.start}px)`}
					>
						<div data-ui="console-entry" data-level={entry.level}>
							<div data-ui="console-entry-meta">
								<span data-ui="console-level">{entry.level}</span>
								{#if entry.timestamp}<time
										data-ui="console-time"
										title={entry.timestamp}>{consoleTimeLabel(
											entry.timestamp,
										)}</time
									>{/if}
							</div>
							<p>{entry.message}</p>
							{#if entry.file}
								<a
									data-ui="compiler-location"
									title={entry.file}
									href={sourceHref(
										entry.file,
										projectPath,
										entry.line,
										entry.column,
									)}>{consoleSourceLabel(entry.file, entry.line)}</a
								>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
