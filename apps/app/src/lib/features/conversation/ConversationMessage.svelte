<script lang="ts">
	import type { ConversationMessage } from '@unity-agent/protocol';
	import { Bot, Check, Copy, User } from '@lucide/svelte';
	import { Button } from '../../components';
	import MarkdownContent from './MarkdownContent.svelte';
	import ToolCallCard from './ToolCallCard.svelte';

	interface Props {
		message: ConversationMessage;
		agentName: string;
	}

	let { message, agentName }: Props = $props();
	let copied = $state(false);

	function formatTime(timestamp: number) {
		return new Intl.DateTimeFormat([], {
			hour: '2-digit',
			minute: '2-digit',
		}).format(timestamp);
	}

	async function copyMessage() {
		if (!message.content || !navigator.clipboard) return;
		await navigator.clipboard.writeText(message.content);
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}
</script>

<article data-ui="message" data-role={message.role}>
	<div data-ui="avatar">
		{#if message.role === 'user'}<User size={15} />{:else}<Bot size={15} />{/if}
	</div>
	<div data-ui="message-body">
		<div data-ui="message-meta">
			<strong>{message.role === 'user' ? 'You' : agentName}</strong>
			<span>{formatTime(message.createdAt)}</span>
			{#if message.content}
				<Button
					variant="ghost"
					size="sm"
					aria-label={message.role === 'assistant'
						? 'Copy response'
						: 'Copy message'}
					onclick={copyMessage}
				>
					{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy{/if}
				</Button>
			{/if}
		</div>
		{#if message.content}<MarkdownContent content={message.content} />{/if}
		{#each message.tools as tool (tool.id)}
			<ToolCallCard {tool} />
		{/each}
		{#if !message.complete && message.role === 'assistant'}
			<span data-ui="streaming-cursor" aria-label="Response streaming"></span>
		{/if}
	</div>
</article>
