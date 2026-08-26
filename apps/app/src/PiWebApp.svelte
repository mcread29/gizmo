<script lang="ts">
	import { onMount } from 'svelte';
	import type { AgentIdentity } from '@gizmo/protocol';
	import {
		AgentStore,
		WebSocketAgentClient,
		type AgentClient,
	} from './lib/agent-client';

	interface Props {
		client?: AgentClient;
	}

	let { client }: Props = $props();
	const agent: AgentIdentity = {
		name: 'Pi Web',
		version: '0.0.0',
		capabilities: [],
	};
	// svelte-ignore state_referenced_locally -- the injected client is intentionally fixed at mount.
	const agentClient = $derived(client ?? new WebSocketAgentClient());
	const store = new AgentStore(agentClient, { allowUnscopedSessions: true });
	let draft = $state('');

	onMount(() => {
		void store.connect();
		return () => void store.disconnect();
	});

	async function submit() {
		const text = draft.trim();
		if (!text || !store.sessionId || store.sessionState === 'streaming') return;
		draft = '';
		await store.prompt(text);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void submit();
		}
	}

	function format(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<svelte:head>
	<title>{agent.name}</title>
	<meta name="description" content="A web frontend for the Pi coding agent" />
</svelte:head>

<main class="pi-web">
	<header>
		<div>
			<h1>{agent.name}</h1>
			<span class:online={store.connection === 'connected'}>
				{store.connection === 'connected' ? 'Connected' : store.connection}
			</span>
		</div>
		<button
			type="button"
			onclick={() => void store.newSession()}
			disabled={store.connection !== 'connected'}
		>
			New session
		</button>
	</header>

	<section class="transcript" aria-live="polite">
		{#if store.messages.length === 0 && store.connection === 'connected'}
			<div class="empty">What would you like to work on?</div>
		{/if}
		{#each store.messages as message (message.id)}
			<article class:assistant={message.role === 'assistant'} class:user={message.role === 'user'}>
				<div class="role">{message.role === 'assistant' ? 'Pi' : 'You'}</div>
				<div class="content">{message.content}</div>
				{#each message.tools as tool (tool.id)}
					<details class="tool" open={tool.status === 'running'}>
						<summary>{tool.name} · {tool.statusText}</summary>
						{#if tool.input !== undefined}<pre>{format(tool.input)}</pre>{/if}
						{#if tool.result !== undefined}<pre>{format(tool.result)}</pre>{/if}
					</details>
				{/each}
			</article>
		{/each}
		{#if store.error}
			<div class="error">{store.error.message}</div>
		{/if}
	</section>

	<form onsubmit={(event) => { event.preventDefault(); void submit(); }}>
		<textarea
			bind:value={draft}
			onkeydown={onKeydown}
			placeholder="Message Pi…"
			aria-label="Message Pi"
			disabled={!store.sessionId || store.sessionState === 'streaming'}
		></textarea>
		<div class="composer-footer">
			<span>Ctrl/⌘ Enter to send</span>
			{#if store.sessionState === 'streaming'}
				<button type="button" onclick={() => store.sessionId && void agentClient.abort(store.sessionId)}>Stop</button>
			{:else}
				<button type="submit" disabled={!draft.trim() || !store.sessionId}>Send</button>
			{/if}
		</div>
	</form>
</main>

<style>
	:global(body) { background: #171717; color: #e7e5e4; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.pi-web { display: grid; grid-template-rows: auto 1fr auto; width: min(100%, 980px); height: 100%; margin: 0 auto; }
	header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #343434; }
	h1 { margin: 0; font-size: 1rem; font-weight: 600; }
	header span { color: #888; font-size: .75rem; }
	header span.online { color: #7cc58a; }
	button { border: 1px solid #555; border-radius: .35rem; background: #252525; color: inherit; padding: .5rem .75rem; cursor: pointer; }
	button:hover:not(:disabled) { background: #333; }
	button:disabled { cursor: default; opacity: .45; }
	.transcript { overflow: auto; padding: 2rem 1.5rem 5rem; }
	.empty { color: #777; padding: 5rem 0; text-align: center; }
	article { max-width: 820px; margin: 0 auto 2rem; }
	.role { margin-bottom: .45rem; color: #999; font-size: .75rem; }
	.content { white-space: pre-wrap; line-height: 1.6; }
	.user .content { color: #c7c4c0; }
	.tool { margin-top: .75rem; border: 1px solid #383838; border-radius: .3rem; color: #aaa; font-size: .75rem; }
	.tool summary { cursor: pointer; padding: .55rem .7rem; }
	pre { overflow: auto; margin: 0; padding: .7rem; border-top: 1px solid #383838; color: #bbb; white-space: pre-wrap; }
	.error { max-width: 820px; margin: 1rem auto; border: 1px solid #914b4b; padding: .75rem; color: #ff9b9b; }
	form { padding: 1rem 1.5rem 1.5rem; background: #171717; }
	textarea { display: block; width: min(100%, 820px); min-height: 6rem; margin: 0 auto; resize: vertical; border: 1px solid #555; border-radius: .35rem; background: #202020; color: inherit; padding: .8rem; outline: none; }
	textarea:focus { border-color: #aaa; }
	.composer-footer { display: flex; justify-content: space-between; width: min(100%, 820px); margin: .5rem auto 0; color: #777; font-size: .7rem; }
	@media (max-width: 600px) { header, form, .transcript { padding-left: 1rem; padding-right: 1rem; } }
</style>
