<script lang="ts">
	import type { ConversationMessage } from '@unity-agent/protocol';
	import { Bot, Check, Copy, RotateCw, User } from '@lucide/svelte';
	import { Button } from '../../components';
	import MarkdownContent from './MarkdownContent.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import { formatMessageTime } from './format';

	interface Props {
		message: ConversationMessage;
		agentName: string;
		projectPath?: string;
		onRetry?: () => void;
	}

	let { message, agentName, projectPath, onRetry }: Props = $props();
	let copied = $state(false);

	async function copyMessage() {
		if (!message.content || !navigator.clipboard) return;
		await navigator.clipboard.writeText(message.content);
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}
</script>

<article
	data-ui="message"
	data-role={message.role}
	data-context-kind="message"
	data-context-id={message.id}
	data-context-label={message.role === 'assistant' ? 'response' : 'message'}
>
	<div data-ui="avatar">
		{#if message.role === 'user'}<User size={15} />{:else}<Bot size={15} />{/if}
	</div>
	<div data-ui="message-body">
		<div data-ui="message-meta">
			<strong>{message.role === 'user' ? 'You' : agentName}</strong>
			<span>{formatMessageTime(message.createdAt)}</span>
			<div data-ui="message-actions">
				{#if onRetry}
					<Button
						variant="ghost"
						size="sm"
						aria-label="Send this message again"
						onclick={onRetry}><RotateCw size={13} /> Retry</Button
					>
				{/if}
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
		</div>
		{#if message.content}<MarkdownContent content={message.content} />{/if}
		{#each message.tools as tool (tool.id)}
			<ToolCallCard {tool} {projectPath} />
		{/each}
		{#if !message.complete && message.role === 'assistant'}
			<p data-ui="streaming-indicator" role="status">
				<span data-ui="streaming-cursor" aria-hidden="true"></span>
				{message.content || message.tools.length ? 'Responding' : 'Thinking'}…
			</p>
		{/if}
	</div>
</article>
