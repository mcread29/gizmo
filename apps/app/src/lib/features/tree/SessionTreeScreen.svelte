<script lang="ts">
	import { copyToClipboard } from '../../clipboard';
	import type { SessionTree } from '@gizmo/protocol';
	import { ArrowLeft, Search } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel, SelectField } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SessionTreeActions from './SessionTreeActions.svelte';
	import SessionTreeList from './SessionTreeList.svelte';
	import { focusOnOpen } from '../shell/modal-screen';
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
	let editing = $state<{ id: string; text: string }>();
	let labelling = $state<{ id: string; text: string }>();
	let branching = $state(false);
	let loadedRevision = '';
	let loadedSessionId: string | undefined;
	let treeRevision = $derived(
		`${store.sessionId ?? ''}:${store.sessions.find((session) => session.id === store.sessionId)?.messageCount ?? 0}:${store.sessionState}`,
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
		rows.find((row) => row.entry.id === selectedId)?.entry ??
			rows.filter((row) => row.active).at(-1)?.entry,
	);
	let branchCount = $derived(
		rows.filter((row) => row.branchCount > 1 && row.branchIndex === 0).length,
	);

	function toggleFold(id: string) {
		const next = new Set(folded);
		if (!next.delete(id)) next.add(id);
		folded = next;
	}

	/** Select a point, then continue in the conversation from that branch. */
	async function startAlternatePath(entryId: string) {
		if (branching) return;
		branching = true;
		try {
			if (!(await store.branchTo(entryId))) return;
			loadedRevision = '';
			toasts.show('Alternate path ready — write the next prompt', 'success');
			onClose();
		} finally {
			branching = false;
		}
	}

	/**
	 * The server treats a user entry as a fork point before that prompt, so the
	 * replacement becomes a sibling instead of an accidental child.
	 */
	async function runEdited() {
		if (!editing || branching) return;
		const { id, text } = editing;
		branching = true;
		try {
			if (!(await store.branchTo(id))) return;
			editing = undefined;
			loadedRevision = '';
			onClose();
			await store.prompt(text);
		} finally {
			branching = false;
		}
	}

	async function saveLabel() {
		if (!labelling) return;
		const { id, text } = labelling;
		labelling = undefined;
		const updated = await store.labelEntry(id, text.trim() || undefined);
		if (updated) tree = updated;
	}

	async function copyEntry(text: string) {
		if (!(await copyToClipboard(text))) return;
		toasts.show('Copied', 'success');
	}
</script>

{#if open}
	<div
		data-ui="tree-screen"
		role="dialog"
		aria-modal="true"
		aria-labelledby="tree-screen-title"
		tabindex="-1"
		{@attach focusOnOpen}
	>
		<header data-ui="tree-header">
			<div data-ui="tree-header-inner">
				<button data-ui="tree-back" onclick={onClose}>
					<ArrowLeft size={15} />
					<span>Back to thread</span>
				</button>
				<div data-ui="tree-heading">
					<span data-ui="eyebrow">THREAD HISTORY</span>
					<h1 id="tree-screen-title">Session tree</h1>
					<p>
						Every turn is kept. Select a point to create an alternate path
						without losing the work that came after it.
					</p>
				</div>
			</div>
			<div data-ui="tree-controls">
				<label data-ui="tree-search">
					<Search size={14} aria-hidden="true" />
					<input
						type="search"
						bind:value={search}
						placeholder="Search this thread…"
						aria-label="Search the session tree"
						autocomplete="off"
					/>
				</label>
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

		<ScrollPanel name="session-tree">
			<div data-ui="tree-body">
				<section data-ui="tree-panel" aria-label="Thread branches">
					<header data-ui="tree-panel-header">
						<div>
							<h2>Paths through this thread</h2>
							<span>{tree?.entries.length ?? 0} recorded turns</span>
						</div>
						<span data-ui="tree-panel-hint">Current path is highlighted</span>
					</header>
					{#if loading && !tree}
						<p data-ui="tree-empty">Reading the session…</p>
					{:else if !rows.length}
						<p data-ui="tree-empty">
							{search
								? 'Nothing matches that search.'
								: 'This thread is empty.'}
						</p>
					{:else}
						<SessionTreeList
							{rows}
							{selectedId}
							onToggleFold={toggleFold}
							onSelect={(id) => (selectedId = id)}
						/>
					{/if}
				</section>
			</div>
		</ScrollPanel>

		<SessionTreeActions
			{selected}
			{branchCount}
			streaming={store.sessionState === 'streaming'}
			busy={branching}
			onLabel={(entry) =>
				(labelling = { id: entry.id, text: entry.label ?? '' })}
			onCopy={(detail) => void copyEntry(detail)}
			onEdit={(entry) =>
				(editing = {
					id: entry.id,
					text: entry.detail ?? entry.summary,
				})}
			onContinue={(entryId) => void startAlternatePath(entryId)}
		/>

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
						disabled={!editing.text.trim() || branching}
						onclick={() => void runEdited()}>Fork</Button
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
	</div>
{/if}
