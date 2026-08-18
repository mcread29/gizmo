<script lang="ts">
	import type { AgentSessionSummary } from '@unity-agent/protocol';
	import { MoreHorizontal } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Menu } from '../../components';
	import { threadTitle } from '../sessions/session-groups';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import Composer from './Composer.svelte';
	import ConversationError from './ConversationError.svelte';
	import MessageList from './MessageList.svelte';

	interface Props {
		store: AgentStore;
		layout: WorkspaceLayout;
		agentName: string;
		currentSession?: AgentSessionSummary;
		focusComposer?: () => void;
		onRename: () => void;
		onExport: () => void;
		onDelete: () => void;
	}

	let {
		store,
		layout,
		agentName,
		currentSession,
		focusComposer = $bindable(),
		onRename,
		onExport,
		onDelete,
	}: Props = $props();
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
			<span data-ui="eyebrow">Thread</span>
			<h1>{threadTitle(currentSession?.title ?? 'New thread')}</h1>
		</div>
		<Menu
			items={[
				{ label: 'Rename', onSelect: onRename },
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

	<ConversationError {store} />

	<MessageList
		{store}
		{agentName}
		{currentSession}
		autoFollowOutput={layout.autoFollowOutput}
	/>

	<div data-ui="composer-wrap">
		<Composer
			{store}
			sendOnEnter={layout.sendOnEnter}
			bind:focus={focusComposer}
		/>
		<p data-ui="disclaimer">
			Unity Agent can modify your project. Review changes before committing.
		</p>
	</div>
</main>
