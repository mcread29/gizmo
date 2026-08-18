<script lang="ts">
	import { Bot, Check, Copy, RotateCw, User } from '@lucide/svelte';
	import { Button } from '../../components';
	import MarkdownContent from './MarkdownContent.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';
	import StreamingIndicator from './StreamingIndicator.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import { formatMessageTime } from './format';
	import { groupContent, type MessageGroup } from './message-groups';
	import type { StreamingActivity } from './streaming';

	interface Props {
		group: MessageGroup;
		agentName: string;
		projectPath?: string;
		onRetry?: () => void;
		/** Present only on the block the agent is currently writing. */
		activity?: StreamingActivity;
		/** Whether reasoning blocks start expanded. */
		expandReasoning?: boolean;
		/** Changes when the thread asks every tool call to collapse. */
		collapseToken?: number;
		/** Ids of messages and tool calls to mark as search hits. */
		matched?: ReadonlySet<string>;
	}

	let {
		group,
		agentName,
		projectPath,
		onRetry,
		activity,
		expandReasoning,
		collapseToken,
		matched,
	}: Props = $props();

	let copied = $state(false);
	let content = $derived(groupContent(group));

	async function copyGroup() {
		if (!content || !navigator.clipboard) return;
		await navigator.clipboard.writeText(content);
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}
</script>

<article data-ui="message" data-role={group.role}>
	<div data-ui="avatar">
		{#if group.role === 'user'}<User size={15} />{:else}<Bot size={15} />{/if}
	</div>
	<div data-ui="message-body">
		<div data-ui="message-meta">
			<strong>{group.role === 'user' ? 'You' : agentName}</strong>
			<span>{formatMessageTime(group.createdAt)}</span>
			<div data-ui="message-actions">
				{#if onRetry}
					<Button
						variant="ghost"
						size="sm"
						aria-label="Send this message again"
						onclick={onRetry}><RotateCw size={13} /> Retry</Button
					>
				{/if}
				{#if content}
					<Button
						variant="ghost"
						size="sm"
						aria-label={group.role === 'assistant'
							? 'Copy response'
							: 'Copy message'}
						onclick={copyGroup}
					>
						{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy{/if}
					</Button>
				{/if}
			</div>
		</div>

		{#each group.messages as message (message.id)}
			<div
				data-ui="message-part"
				data-context-kind="message"
				data-context-id={message.id}
				data-context-label={group.role === 'assistant' ? 'response' : 'message'}
				data-matched={matched?.has(message.id) || undefined}
			>
				<ReasoningBlock
					reasoning={message.reasoning}
					redacted={message.reasoningRedacted}
					expanded={expandReasoning}
				/>
				{#if message.content}
					<!-- Live so a screen reader hears the reply as it is written. -->
					<div aria-live={activity ? 'polite' : undefined}>
						<MarkdownContent content={message.content} />
					</div>
				{/if}
				{#each message.tools as tool (tool.id)}
					<ToolCallCard
						{tool}
						{projectPath}
						{collapseToken}
						matched={matched?.has(tool.id)}
					/>
				{/each}
			</div>
		{/each}

		{#if activity}<StreamingIndicator {activity} />{/if}
	</div>
</article>
