<script lang="ts">
	import type { AgentSessionSummary } from '@gizmo/protocol';
	import { FolderOpen, GitBranch, MoreHorizontal, Plus } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Menu } from '../../components';
	import { threadTitle } from '../sessions/session-groups';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import Composer from './Composer.svelte';
	import type { DraftStore } from './drafts.svelte';
	import ConversationError from './ConversationError.svelte';
	import MessageList from './MessageList.svelte';
	import TranscriptSearch from './TranscriptSearch.svelte';
	import PiExtensionWidgets from '../extension-ui/PiExtensionWidgets.svelte';
	import PiExtensionQuestion from '../extension-ui/PiExtensionQuestion.svelte';
	import type { PiExtensionUiStore } from '../extension-ui/PiExtensionUiStore.svelte';
	import { workspaceNameFromPath } from '../../extensions/workspace-label';
	import { findMatches, stepIndex } from './transcript-search';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		drafts: DraftStore;
		extensionUi: PiExtensionUiStore;
		agentName: string;
		currentSession?: AgentSessionSummary;
		focusComposer?: () => void;
		findInThread?: () => void;
		onRename: () => void;
		onCopy: () => void;
		onExport: () => void;
		onDelete: () => void;
		onOpenTree: () => void;
		onNewThread: () => void;
	}

	let {
		store,
		layout,
		drafts,
		extensionUi,
		agentName,
		currentSession,
		focusComposer = $bindable(),
		findInThread = $bindable(),
		onRename,
		onCopy,
		onExport,
		onDelete,
		onOpenTree,
		onNewThread,
	}: Props = $props();

	let searchOpen = $state(false);
	let query = $state('');
	let matchIndex = $state(0);
	let focusSearch = $state<() => void>();
	let collapseToken = $state(0);
	let revealMessage = $state<(id: string) => Promise<void>>();

	let matches = $derived(findMatches(store.messages, query));
	// The workspace overview is its own screen now; an empty thread is a thread.
	let empty = $derived(!store.messagesLoading && store.messages.length === 0);
	let workspaceLabel = $derived(
		workspaceNameFromPath(store.selectedProjectPath),
	);
	// A persisted tool still marked running while no run is active means the
	// transcript outlived an interrupted stream; say so instead of ending the
	// thread mid-thought with no explanation.
	let interrupted = $derived(
		store.sessionState !== 'streaming' &&
			!store.messagesLoading &&
			store.messages.some(
				(message) =>
					message.role === 'assistant' &&
					message.tools.some((tool) => tool.status === 'running'),
			),
	);
	let editorCommand = $derived(extensionUi.editorCommandFor(store.sessionId));

	// A shrinking result set must not leave the cursor past the end.
	$effect(() => {
		if (matchIndex >= matches.ids.length) matchIndex = 0;
	});

	$effect(() => {
		if (!editorCommand) return;
		drafts.set(store.sessionId, editorCommand.request.text);
		extensionUi.consumeEditorCommand(editorCommand);
		void tick().then(() => focusComposer?.());
	});

	findInThread = () => {
		searchOpen = true;
		void tick().then(() => focusSearch?.());
	};

	function step(direction: 1 | -1) {
		if (matches.ids.length === 0) return;
		matchIndex = stepIndex(matchIndex, matches.ids.length, direction);
		revealMatch();
	}

	function revealMatch() {
		const id = matches.ids[matchIndex];
		if (!id) return;
		void revealMessage?.(id);
	}

	function closeSearch() {
		searchOpen = false;
		query = '';
	}
</script>

<main
	id="conversation"
	data-ui="conversation"
	data-context-kind="thread"
	data-context-id={currentSession?.id}
	data-state={store.sessionState}
	tabindex="-1"
>
	<!--
		The same two rows as the workspace screen: the workspace identifies the
		column, and the row beneath says which of its surfaces is open. There
		the row holds Overview/Configure; here the open thread takes their
		place, so switching between the two does not move the shelf line.
	-->
	<div data-ui="conversation-header">
		<div>
			<h1>{workspaceLabel ?? 'Workspace'}</h1>
			{#if store.selectedProjectPath}
				<p data-ui="workspace-path" title={store.selectedProjectPath}>
					<FolderOpen size={13} />
					<span>{store.selectedProjectPath}</span>
				</p>
			{/if}
		</div>
		{#if layout.phone}
			<Button
				size="icon"
				variant="secondary"
				aria-label="New thread"
				disabled={store.connection !== 'connected'}
				onclick={onNewThread}><Plus size={16} /></Button
			>
		{:else}
			<Button
				size="sm"
				disabled={store.connection !== 'connected'}
				onclick={onNewThread}><Plus size={14} /> New thread</Button
			>
		{/if}
	</div>

	<div data-ui="conversation-shelf">
		<strong title={threadTitle(currentSession?.title ?? 'New thread')}
			>{threadTitle(currentSession?.title ?? 'New thread')}</strong
		>
		<div data-ui="conversation-header-actions">
			<Button
				data-ui="tree-trigger"
				variant="ghost"
				size="sm"
				title="Browse alternate paths"
				disabled={!store.sessionId}
				onclick={onOpenTree}><GitBranch size={14} /> Tree</Button
			>
			<Menu
				items={[
					{ label: 'Find in thread', onSelect: () => findInThread?.() },
					{
						label: 'Collapse tool calls',
						onSelect: () => collapseToken++,
					},
					{ label: 'Rename', onSelect: onRename },
					{ label: 'Copy transcript', onSelect: onCopy },
					{ label: 'Export transcript', onSelect: onExport },
					{
						label: 'Delete',
						tone: 'danger',
						disabled: store.sessionState === 'streaming',
						onSelect: onDelete,
					},
				]}
			>
				{#snippet trigger(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Thread actions"><MoreHorizontal size={18} /></Button
					>
				{/snippet}
			</Menu>
		</div>
	</div>

	{#if searchOpen}
		<TranscriptSearch
			bind:query
			bind:focus={focusSearch}
			matchCount={matches.ids.length}
			index={matchIndex}
			onStep={step}
			onClose={closeSearch}
		/>
	{/if}

	<ConversationError {store} />

	{#if interrupted}
		<!-- Not role=status: one-shot context, not a change to announce over
			toasts and other live regions. -->
		<div data-ui="interrupted-notice" role="note">
			The previous run was interrupted before it finished.
		</div>
	{/if}

	{#if store.messagesLoading}
		<!-- A blank transcript would read as an empty thread, so say nothing. -->
		<div data-ui="transcript-skeleton" aria-label="Loading thread">
			{#each [0, 1, 2] as block (block)}
				<div data-ui="transcript-skeleton-block">
					<div data-ui="skeleton" data-shape="line" data-width="short"></div>
					<div data-ui="skeleton" data-shape="line"></div>
					<div data-ui="skeleton" data-shape="line"></div>
				</div>
			{/each}
		</div>
	{:else if empty}
		<div data-ui="thread-empty">
			<strong>New thread</strong>
			{#if workspaceLabel}
				<span>Ask about {workspaceLabel} to start.</span>
			{:else}
				<span>Ask about your workspace to start.</span>
			{/if}
		</div>
	{:else}
		<MessageList
			{store}
			{extensionUi}
			{agentName}
			{currentSession}
			{collapseToken}
			matched={matches.set}
			bind:reveal={revealMessage}
			autoFollowOutput={layout.autoFollowOutput}
			expandReasoning={layout.expandReasoning}
		/>
	{/if}

	<div data-ui="composer-wrap">
		<PiExtensionWidgets
			ui={extensionUi}
			sessionId={store.sessionId}
			placement="aboveEditor"
		/>
		{#if extensionUi.questionsFor(store.sessionId)[0]}
			<!-- While the agent waits for an answer, the question takes the
				composer's place: options and a custom-answer input instead of
				the regular message editor. -->
			<PiExtensionQuestion
				ui={extensionUi}
				question={extensionUi.questionsFor(store.sessionId)[0]}
			/>
		{:else}
			<Composer
				{store}
				{drafts}
				sendOnEnter={layout.enterSends}
				bind:focus={focusComposer}
			/>
		{/if}
		<PiExtensionWidgets
			ui={extensionUi}
			sessionId={store.sessionId}
			placement="belowEditor"
		/>
	</div>
</main>
