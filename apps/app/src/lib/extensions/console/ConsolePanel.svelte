<script lang="ts">
	import {
		createVirtualizer,
		observeElementRect,
	} from '@tanstack/svelte-virtual';
	import {
		ChevronDown,
		ChevronRight,
		Copy,
		RotateCw,
		Search,
		Terminal,
		Trash2,
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import './console.css';
	import type { ConsoleExtensionRuntime } from './console-extension.svelte';
	import { Button, Tabs, Tooltip } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import { sourceHref } from '../../features/unity/compiler-diagnostics';
	import {
		consoleLine,
		consoleSourceLabel,
		consoleTimeLabel,
		matchesConsoleFilter,
	} from './console-log';

	interface Props {
		runtime: ConsoleExtensionRuntime;
	}

	let { runtime }: Props = $props();

	let level = $state('all');
	let filter = $state('');
	let viewport = $state<HTMLDivElement | null>(null);
	let following = true;
	let rowKeys: Array<string | number> = [];
	let expanded = $state(new Set<string | number>());

	let rows = $derived(
		runtime.entries
			.map((entry, index) => ({ entry, key: entry.seq ?? index }))
			.filter(({ entry }) => matchesConsoleFilter(entry, level, filter)),
	);
	let entries = $derived(rows.map(({ entry }) => entry));
	let counts = $derived(runtime.counts);
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
	let virtualItems = $derived(
		$virtualizer.getVirtualItems().filter((row) => row.index < rows.length),
	);

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

	function toggleEntry(key: string | number) {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expanded = next;
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
				{
					value: 'all',
					label: 'All',
					shortLabel: 'All',
					badge: counts.logs + counts.warnings + counts.errors,
				},
				{
					value: 'warn',
					label: 'Warnings',
					shortLabel: 'Warn',
					badge: counts.warnings,
				},
				{
					value: 'error',
					label: 'Errors',
					shortLabel: 'Error',
					badge: counts.errors,
					badgeTone: 'danger',
				},
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
						disabled={runtime.manualRefreshing}
						onclick={() => void runtime.refresh(true)}
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
						disabled={runtime.entries.length === 0}
						onclick={() => runtime.clearLocal()}><Trash2 size={13} /></Button
					>
				{/snippet}
			</Tooltip>
		</div>
	</div>

	{#if entries.length === 0}
		<div data-ui="empty-state">
			<Terminal size={22} /><strong>
				{runtime.entries.length ? 'Nothing matches' : 'Console is quiet'}
			</strong><span>
				{#if runtime.entries.length}
					No lines match the current filter.
				{:else if runtime.loading}
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
					{@const entryKey = rows[row.index]!.key}
					{@const isExpanded = expanded.has(entryKey)}
					<div
						data-ui="console-row"
						data-index={row.index}
						use:measure
						style={`transform:translateY(${row.start}px)`}
					>
						<div
							data-ui="console-entry"
							data-level={entry.level}
							data-expanded={isExpanded || undefined}
						>
							<div data-ui="console-entry-meta">
								<div data-ui="console-entry-heading">
									<button
										type="button"
										data-ui="console-expand"
										aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
										aria-expanded={isExpanded}
										onclick={() => toggleEntry(entryKey)}
									>
										{#if isExpanded}<ChevronDown
												size={12}
											/>{:else}<ChevronRight size={12} />{/if}
									</button>
									<span data-ui="console-level">{entry.level}</span>
								</div>
								{#if entry.timestamp}<time
										data-ui="console-time"
										title={entry.timestamp}
										>{consoleTimeLabel(entry.timestamp)}</time
									>{/if}
							</div>
							<p data-ui="console-message">{entry.message}</p>
							{#if isExpanded && entry.stackTrace}
								<pre data-ui="console-stack">{entry.stackTrace}</pre>
							{/if}
							{#if entry.file}
								<a
									data-ui="compiler-location"
									title={entry.file}
									href={sourceHref(
										entry.file,
										runtime.projectPath,
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
