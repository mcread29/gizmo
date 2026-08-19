<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import { Moon, PanelLeft, PanelRight, Settings, Sun } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { BrandMark, Button, Tooltip } from '../../components';
	import StreamingIndicator from '../conversation/StreamingIndicator.svelte';
	import { streamingActivity } from '../conversation/streaming';
	import { shortcutHint } from './shortcuts';
	import WindowControls from './WindowControls.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import type { UnityView } from '../unity/unity-view';

	interface Props {
		agent: AgentIdentity;
		layout: WorkspaceLayout;
		view: UnityView;
		store: AgentStore;
		onOpenSettings: () => void;
	}

	let { agent, layout, view, store, onOpenSettings }: Props = $props();

	// Visible even when the conversation is scrolled away from the newest reply.
	let activity = $derived(
		streamingActivity(store.messages, store.sessionState),
	);
</script>

<!-- The window has no native decorations, so the bar itself moves it. -->
<header data-ui="titlebar" data-tauri-drag-region>
	<div data-ui="titlebar-start">
		<Tooltip
			text={`${layout.leftVisible ? 'Hide' : 'Show'} thread sidebar · ${shortcutHint('B')}`}
		>
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle thread sidebar"
					aria-expanded={layout.leftVisible}
					onclick={() => layout.toggleLeft()}
				>
					<PanelLeft size={17} />
				</Button>
			{/snippet}
		</Tooltip>
		<div data-ui="brand-mark" data-tauri-drag-region>
			<BrandMark />
		</div>
		<strong data-tauri-drag-region>{agent.name}</strong>
		<span data-ui="preview-badge">Preview</span>
	</div>
	<div data-ui="titlebar-center" data-tauri-drag-region>
		<span data-ui="project-dot" data-state={view.status?.state}></span>
		<span>{view.projectName}</span>
		{#if activity.streaming}
			<StreamingIndicator {activity} compact />
		{:else}
			<span data-ui="muted"
				>{view.version ? `Unity ${view.version}` : view.state}</span
			>
		{/if}
	</div>
	<div data-ui="titlebar-end">
		<Tooltip text={layout.darkTheme ? 'Use light theme' : 'Use dark theme'}>
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle color theme"
					onclick={() => layout.toggleTheme()}
				>
					{#if layout.darkTheme}<Sun size={17} />{:else}<Moon size={17} />{/if}
				</Button>
			{/snippet}
		</Tooltip>
		<Tooltip text={`Settings · ${shortcutHint(',')}`}>
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Settings"
					onclick={onOpenSettings}><Settings size={17} /></Button
				>
			{/snippet}
		</Tooltip>
		<Tooltip
			text={`${layout.rightVisible ? 'Hide' : 'Show'} editor inspector · ${shortcutHint('⇧B')}`}
		>
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle editor inspector"
					aria-expanded={layout.rightVisible}
					onclick={() => layout.toggleRight()}
				>
					<PanelRight size={17} />
				</Button>
			{/snippet}
		</Tooltip>
		<WindowControls />
	</div>
</header>
