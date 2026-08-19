<script lang="ts">
	import type { SessionTree } from '@unity-agent/protocol';
	import {
		ArrowLeft,
		Bookmark,
		ChevronDown,
		ChevronRight,
		Copy,
		CornerUpLeft,
		Pencil,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel, SelectField } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import {
		treeFilterLabels,
		treeFilters,
		treeRows,
		type TreeFilter,
	} from './session-tree';

	interface Props {
		open?: boolean;
		store: AgentStore;
		onClose: () => void;
	}

	let { open = false, store, onClose }: Props = $props();

	let tree = $state<SessionTree>();
	let loading = $state(false);
	let filter = $state<TreeFilter>('default');
	let search = $state('');
	let folded = $state(new Set<string>());
	let selectedId = $state<string>();
	let editing = $state<{ id: string; parentId: string | null; text: string }>();
	let labelling = $state<{ id: string; text: string }>();
	let loadedRevision = '';
	let loadedSessionId: string | undefined;
	let treeRevision = $derived(
		`${store.sessionId ?? ''}:${store.sessions.find((session) => session.id === store.sessionId)?.messageCount ?? 0}`,
	);

	$effect(() => {
		if (open && treeRevision !== loadedRevision) void reload(treeRevision);
	});

	async function reload(revision = treeRevision) {
		loading = true;
		try {
			const result = await store.loadTree();
			if (revision !== treeRevision) return;
			tree = result;
			if (result) {
				loadedRevision = revision;
				selectedId =
					loadedSessionId === store.sessionId
						? (selectedId ?? result.leafId ?? undefined)
						: (result.leafId ?? undefined);
				loadedSessionId = store.sessionId;
			}
		} finally {
			if (revision === treeRevision) loading = false;
		}
	}

	let rows = $derived(tree ? treeRows(tree, { filter, search, folded }) : []);
	let selected = $derived(
		rows.find((row) => row.entry.id === selectedId)?.entry,
	);
	let branchCount = $derived(
		rows.filter((row) => row.branchCount > 1 && row.branchIndex === 0).length,
	);

	function toggleFold(id: string) {
		const next = new Set(folded);
		if (!next.delete(id)) next.add(id);
		folded = next;
	}

	/** Moves the thread's leaf, so the next prompt continues from here. */
	async function goHere(entryId: string) {
		if (!(await store.branchTo(entryId))) return;
		loadedRevision = '';
		toasts.show('Thread continues from this point', 'success');
		onClose();
	}

	/**
	 * Re-running a prompt means continuing from its parent, so the new reply is
	 * a sibling of the old one rather than a child of it.
	 */
	async function runEdited() {
		if (!editing) return;
		const { parentId, text } = editing;
		editing = undefined;
		if (!(await store.branchTo(parentId))) return;
		loadedRevision = '';
		onClose();
		await store.prompt(text);
	}

	async function saveLabel() {
		if (!labelling) return;
		const { id, text } = labelling;
		labelling = undefined;
		const updated = await store.labelEntry(id, text.trim() || undefined);
		if (updated) tree = updated;
	}

	async function copyEntry(text: string) {
		if (!navigator.clipboard) return;
		await navigator.clipboard.writeText(text);
		toasts.show('Copied', 'success');
	}
</script>

{#if open}
	<section data-ui="tree-screen" aria-label="Session tree">
		<header data-ui="tree-header">
			<button data-ui="settings-back" onclick={onClose}>
				<ArrowLeft size={15} />
				<span>Back</span>
			</button>
			<h1>Session tree</h1>
			<span>
				Every turn this thread has taken, including the branches it walked away
				from. Nothing here is ever deleted.
			</span>
			<div data-ui="tree-controls">
				<input
					type="search"
					bind:value={search}
					placeholder="Search this thread…"
					aria-label="Search the session tree"
					autocomplete="off"
				/>
				<SelectField
					value={filter}
					label="Show"
					options={treeFilters.map((value) => ({
						value,
						label: treeFilterLabels[value],
					}))}
					onValueChange={(value) => (filter = value as TreeFilter)}
				/>
			</div>
		</header>

		<ScrollPanel>
			<div data-ui="tree-body">
				{#if loading && !tree}
					<p data-ui="tree-empty">Reading the session…</p>
				{:else if !rows.length}
					<p data-ui="tree-empty">
						{search ? 'Nothing matches that search.' : 'This thread is empty.'}
					</p>
				{:else}
					<ol data-ui="tree-list">
						{#each rows as row (row.entry.id)}
							<li
								data-ui="tree-row"
								data-kind={row.entry.kind}
								data-active={row.active || undefined}
								data-leaf={row.leaf || undefined}
								data-selected={row.entry.id === selectedId || undefined}
								style={`--depth:${row.depth}`}
							>
								<button
									data-ui="tree-fold"
									aria-label={row.folded ? 'Unfold' : 'Fold'}
									disabled={!row.foldable}
									onclick={() => toggleFold(row.entry.id)}
								>
									{#if row.foldable}
										{#if row.folded}<ChevronRight
												size={13}
											/>{:else}<ChevronDown size={13} />{/if}
									{/if}
								</button>
								<button
									data-ui="tree-entry"
									onclick={() => (selectedId = row.entry.id)}
									ondblclick={() => void goHere(row.entry.id)}
								>
									<span data-ui="tree-kind">{row.entry.kind}</span>
									<span data-ui="tree-summary">{row.entry.summary}</span>
									{#if row.entry.label}
										<span data-ui="tree-label">
											<Bookmark size={11} />{row.entry.label}
										</span>
									{/if}
									{#if row.branchCount > 1}
										<span data-ui="tree-branch"
											>branch {row.branchIndex + 1}/{row.branchCount}</span
										>
									{/if}
									{#if row.leaf}<span data-ui="tree-here">here</span>{/if}
								</button>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</ScrollPanel>

		<footer data-ui="tree-actions">
			{#if branchCount}
				<span data-ui="tree-count"
					>{branchCount} branch point{branchCount === 1 ? '' : 's'}</span
				>
			{/if}
			{#if selected}
				<Button
					variant="secondary"
					size="sm"
					onclick={() =>
						(labelling = { id: selected.id, text: selected.label ?? '' })}
					><Bookmark size={13} /> Label</Button
				>
				{#if selected.detail}
					<Button
						variant="secondary"
						size="sm"
						onclick={() => void copyEntry(selected.detail ?? '')}
						><Copy size={13} /> Copy</Button
					>
				{/if}
				{#if selected.kind === 'user'}
					<Button
						variant="secondary"
						size="sm"
						disabled={store.sessionState === 'streaming'}
						onclick={() =>
							(editing = {
								id: selected.id,
								parentId: selected.parentId,
								text: selected.detail ?? selected.summary,
							})}><Pencil size={13} /> Edit and re-run</Button
					>
				{/if}
				<Button
					variant="primary"
					size="sm"
					disabled={store.sessionState === 'streaming'}
					onclick={() => void goHere(selected.id)}
					><CornerUpLeft size={13} /> Continue from here</Button
				>
			{:else}
				<span data-ui="tree-count">Select an entry to act on it.</span>
			{/if}
		</footer>

		{#if editing}
			<div data-ui="tree-editor">
				<label for="tree-edit">Edit the prompt and run it again</label>
				<textarea id="tree-edit" bind:value={editing.text} rows="5"></textarea>
				<p>
					The reply you had stays in the tree as a branch. It is not deleted.
				</p>
				<div>
					<Button
						variant="secondary"
						size="sm"
						onclick={() => (editing = undefined)}>Cancel</Button
					>
					<Button
						variant="primary"
						size="sm"
						disabled={!editing.text.trim()}
						onclick={() => void runEdited()}>Run</Button
					>
				</div>
			</div>
		{/if}

		{#if labelling}
			<div data-ui="tree-editor">
				<label for="tree-label">Label this entry</label>
				<input id="tree-label" bind:value={labelling.text} />
				<p>
					Labels stay visible in every filter, so a good run is easy to find.
				</p>
				<div>
					<Button
						variant="secondary"
						size="sm"
						onclick={() => (labelling = undefined)}>Cancel</Button
					>
					<Button variant="primary" size="sm" onclick={() => void saveLabel()}
						>Save</Button
					>
				</div>
			</div>
		{/if}
	</section>
{/if}
