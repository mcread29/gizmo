<script lang="ts">
	import {
		Check,
		ChevronDown,
		ChevronRight,
		Copy,
		FileCode2,
		Folder,
		Undo2,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Tooltip } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import DiffView from '../conversation/DiffView.svelte';
	import { sourceHref } from '../unity/compiler-diagnostics';
	import { changeTotals, threadChanges } from './thread-changes';
	import { changeTree, changeTreeRows } from './change-tree';

	interface Props {
		store: AgentStore;
		projectPath?: string;
	}

	let { store, projectPath }: Props = $props();

	let files = $derived(threadChanges(store.messages));
	let totals = $derived(changeTotals(files));
	let tree = $derived(changeTree(files, projectPath));
	let collapsedFolders = $state(new Set<string>());
	let rows = $derived(changeTreeRows(tree, collapsedFolders));
	let expanded = $state(new Set<string>());
	let reverting = $state<string>();

	function toggle(file: string) {
		const next = new Set(expanded);
		if (!next.delete(file)) next.add(file);
		expanded = next;
	}

	function toggleFolder(path: string) {
		const next = new Set(collapsedFolders);
		if (!next.delete(path)) next.add(path);
		collapsedFolders = next;
	}

	async function copyPatch(patch: string) {
		if (!navigator.clipboard) return;
		await navigator.clipboard.writeText(patch);
		toasts.show('Patch copied');
	}

	async function revert(file: string, toolCallId: string, patch: string) {
		reverting = toolCallId;
		try {
			await store.revertFile(file, patch);
			toasts.show(`Reverted the change to ${file}`);
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : String(error),
				'danger',
			);
		} finally {
			reverting = undefined;
		}
	}
</script>

{#if files.length === 0}
	<div data-ui="empty-state">
		<Check size={22} /><strong>No file changes</strong><span
			>Edits the agent makes in this thread are collected here.</span
		>
	</div>
{:else}
	<div data-ui="change-summary">
		<span>{files.length} file{files.length === 1 ? '' : 's'}</span>
		<span data-kind="added">+{totals.added}</span>
		<span data-kind="removed">−{totals.removed}</span>
	</div>
	<div data-ui="change-list">
		{#each rows as row (row.node.path)}
			{#if row.node.kind === 'folder'}
				<button
					type="button"
					data-ui="change-folder"
					style={`--depth:${row.depth}`}
					aria-expanded={!collapsedFolders.has(row.node.path)}
					onclick={() => toggleFolder(row.node.path)}
				>
					{#if collapsedFolders.has(row.node.path)}<ChevronRight
							size={12}
						/>{:else}<ChevronDown size={12} />{/if}
					<Folder size={14} />
					<strong>{row.node.name}</strong>
				</button>
			{:else}
				{@const entry = row.node.entry}
				<section
					data-ui="change-file"
					data-expanded={expanded.has(entry.file) || undefined}
					style={`--depth:${row.depth}`}
				>
					<button
						type="button"
						data-ui="change-header"
						aria-expanded={expanded.has(entry.file)}
						onclick={() => toggle(entry.file)}
					>
						<span data-ui="change-tree-spacer"></span>
						<FileCode2 size={14} />
						<span title={entry.file}>{row.node.name}</span>
						<small data-kind="added">+{entry.added}</small>
						<small data-kind="removed">−{entry.removed}</small>
					</button>
					{#if expanded.has(entry.file)}
						{#each entry.changes as change (change.toolCallId)}
							<div data-ui="change-body">
								<DiffView
									diff={change.patch}
									file={entry.file}
									{projectPath}
									showFileName={false}
									wrap
								/>
								<div data-ui="change-actions">
									{#if sourceHref(entry.file, projectPath)}
										<a
											data-ui="change-link"
											href={sourceHref(entry.file, projectPath)}>Open</a
										>
									{/if}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => copyPatch(change.patch)}
										><Copy size={13} /> Copy</Button
									>
									<Tooltip
										text="Restores the file to its state before this edit"
									>
										{#snippet children(props)}
											<Button
												{...props}
												variant="ghost"
												size="sm"
												disabled={change.status !== 'complete' ||
													reverting === change.toolCallId}
												onclick={() =>
													revert(entry.file, change.toolCallId, change.patch)}
												><Undo2 size={13} />
												{reverting === change.toolCallId
													? 'Reverting…'
													: 'Revert'}</Button
											>
										{/snippet}
									</Tooltip>
								</div>
							</div>
						{/each}
					{/if}
				</section>
			{/if}
		{/each}
	</div>
{/if}
