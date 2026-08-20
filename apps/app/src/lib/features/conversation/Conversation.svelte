<script lang="ts">
	import type { AgentSessionSummary } from '@unity-agent/protocol';
	import { GitBranch, MoreHorizontal } from '@lucide/svelte';
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
	import WorkspaceDashboard from '../workspace/WorkspaceDashboard.svelte';
	import { findMatches, stepIndex } from './transcript-search';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		drafts: DraftStore;
		agentName: string;
		currentSession?: AgentSessionSummary;
		focusComposer?: () => void;
		findInThread?: () => void;
		onRename: () => void;
		onCopy: () => void;
		onExport: () => void;
		onDelete: () => void;
		onOpenTree: () => void;
		onOpenThread: (sessionId: string) => void;
		onManageWorkspace: () => void;
	}

	let {
		store,
		layout,
		drafts,
		agentName,
		currentSession,
		focusComposer = $bindable(),
		findInThread = $bindable(),
		onRename,
		onCopy,
		onExport,
		onDelete,
		onOpenTree,
		onOpenThread,
		onManageWorkspace,
	}: Props = $props();

	let searchOpen = $state(false);
	let query = $state('');
	let matchIndex = $state(0);
	let focusSearch = $state<() => void>();
	let collapseToken = $state(0);
	let revealMessage = $state<(id: string) => Promise<void>>();

	let matches = $derived(findMatches(store.messages, query));
	let showDashboard = $derived(
		!store.messagesLoading && store.messages.length === 0,
	);

	// A shrinking result set must not leave the cursor past the end.
	$effect(() => {
		if (matchIndex >= matches.ids.length) matchIndex = 0;
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
	<div data-ui="conversation-header">
		<div>
			<span data-ui="eyebrow">{showDashboard ? 'Workspace' : 'Thread'}</span>
			<h1
				>{showDashboard
					? store.projects.find(
							({ path }) => path === store.selectedProjectPath,
						)?.title ?? 'Workspace'
					: threadTitle(currentSession?.title ?? 'New thread')}</h1
			>
		</div>
		<div data-ui="conversation-header-actions">
			<Button
				variant="secondary"
				size="sm"
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

	{#if showDashboard}
		<WorkspaceDashboard {store} {onOpenThread} {onManageWorkspace} />
	{:else}
		<MessageList
			{store}
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
		<Composer
			{store}
			{drafts}
			sendOnEnter={layout.sendOnEnter}
			bind:focus={focusComposer}
		/>
		<p data-ui="disclaimer">
			Gizmo can modify your project. Review changes before committing.
		</p>
	</div>
</main>
