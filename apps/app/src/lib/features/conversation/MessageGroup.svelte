<script lang="ts">
	import { Bot, Check, Copy, User } from '@lucide/svelte';
	import { Button } from '../../components';
	import MarkdownContent from './MarkdownContent.svelte';
	import MessageAttachments from './MessageAttachments.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';
	import StreamingIndicator from './StreamingIndicator.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import { formatMessageTime } from './format';
	import { groupContent, type MessageGroup } from './message-groups';
	import type { StreamingActivity } from './streaming';
	import type { AttachmentContent } from '../../agent-client/AgentClient';

	interface Props {
		group: MessageGroup;
		agentName: string;
		projectPath?: string;
		/** Present only on the block the agent is currently writing. */
		activity?: StreamingActivity;
		/** Whether reasoning blocks start expanded. */
		expandReasoning?: boolean;
		/** Changes when the thread asks every tool call to collapse. */
		collapseToken?: number;
		/** Ids of messages and tool calls to mark as search hits. */
		matched?: ReadonlySet<string>;
		onReadAttachment?: (id: string) => Promise<AttachmentContent>;
		onRevealAttachment?: (id: string) => Promise<void>;
		groupedBefore?: boolean;
		groupedAfter?: boolean;
	}

	let {
		group,
		agentName,
		projectPath,
		activity,
		expandReasoning,
		collapseToken,
		matched,
		onReadAttachment = async () => {
			throw new Error('Attachment is unavailable');
		},
		onRevealAttachment = async () => {},
		groupedBefore = false,
		groupedAfter = false,
	}: Props = $props();

	let copied = $state(false);
	let hasContent = $derived(
		group.messages.some((message) => Boolean(message.content)),
	);
	let lastMessageId = $derived(group.messages.at(-1)?.id);

	async function copyGroup() {
		const content = groupContent(group);
		if (!content || !navigator.clipboard) return;
		await navigator.clipboard.writeText(content);
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}
</script>

<article
	data-ui="message"
	data-role={group.role}
	data-grouped-before={groupedBefore || undefined}
	data-grouped-after={groupedAfter || undefined}
>
	<div data-ui="avatar">
		{#if !groupedBefore}
			{#if group.role === 'user'}<User size={15} />{:else}<Bot size={15} />{/if}
		{/if}
	</div>
	<div data-ui="message-body">
		{#if !groupedBefore}
			<div data-ui="message-meta">
				<strong>{group.role === 'user' ? 'You' : agentName}</strong>
				<span>{formatMessageTime(group.createdAt)}</span>
				{#if group.role === 'user'}
					<div data-ui="message-actions">
						{#if hasContent}
							<Button
								variant="ghost"
								size="sm"
								aria-label="Copy message"
								onclick={copyGroup}
							>
								{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy{/if}
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#each group.messages as message (message.id)}
			<div
				data-ui="message-part"
				data-context-kind="message"
				data-context-id={message.id}
				data-context-label={group.role === 'assistant' ? 'response' : 'message'}
				data-matched={matched?.has(message.id) || undefined}
			>
				{#if message.attachments?.length}
					<MessageAttachments
						attachments={message.attachments}
						onRead={onReadAttachment}
						onReveal={onRevealAttachment}
					/>
				{/if}
				<ReasoningBlock
					reasoning={message.reasoning}
					redacted={message.reasoningRedacted}
					expanded={expandReasoning}
					streaming={Boolean(activity && message.id === lastMessageId)}
				/>
				{#if message.content}
					<!-- Live so a screen reader hears the reply as it is written. -->
					<div
						data-ui="message-content"
						aria-live={activity ? 'polite' : undefined}
					>
						<MarkdownContent
							content={message.content}
							streaming={Boolean(activity && message.id === lastMessageId)}
						/>
					</div>
				{/if}
				{#each message.tools as tool (tool.id)}
					<ToolCallCard
						{tool}
						{projectPath}
						{collapseToken}
						active={Boolean(activity && tool.status === 'running')}
						matched={matched?.has(tool.id)}
					/>
				{/each}
			</div>
		{/each}

		{#if activity}<StreamingIndicator {activity} />{/if}
		{#if group.role === 'assistant' && hasContent}
			<div data-ui="message-footer">
				<div data-ui="message-actions">
					<Button
						variant="ghost"
						size="sm"
						aria-label="Copy response"
						onclick={copyGroup}
					>
						{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy{/if}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</article>
