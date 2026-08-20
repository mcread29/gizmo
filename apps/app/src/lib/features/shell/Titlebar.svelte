<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import { Moon, Settings, Sun } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { BrandMark, Button, Tooltip } from '../../components';
	import StreamingIndicator from '../conversation/StreamingIndicator.svelte';
	import { streamingActivity } from '../conversation/streaming';
	import { shortcutHint } from './shortcuts';
	import PanelToggle from './PanelToggle.svelte';
	import WindowControls from './WindowControls.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import type { WorkspaceView } from '../../domains/types';

	interface Props {
		agent: AgentIdentity;
		layout: WorkspaceLayout;
		view: WorkspaceView;
		store: AgentStore;
		/**
		 * A full screen such as Settings covers the workspace. The bar then keeps
		 * only what still does something: identity, the theme toggle, and the
		 * window controls.
		 */
		screenOpen?: boolean;
		onOpenSettings: () => void;
	}

	let {
		agent,
		layout,
		view,
		store,
		screenOpen = false,
		onOpenSettings,
	}: Props = $props();

	// Visible even when the conversation is scrolled away from the newest reply.
	let activity = $derived(
		streamingActivity(store.messages, store.sessionState),
	);
</script>

<!-- The window has no native decorations, so the bar itself moves it. -->
<header data-ui="titlebar" data-tauri-drag-region>
	<div data-ui="titlebar-start">
		{#if !screenOpen && layout.leftMode === 'overlay'}
			<PanelToggle
				side="left"
				expanded={layout.leftVisible}
				onToggle={() => layout.toggleLeft()}
			/>
		{/if}
		<div data-ui="brand-mark" data-tauri-drag-region>
			<BrandMark />
		</div>
		<strong data-tauri-drag-region>{agent.name}</strong>
		<span data-ui="preview-badge">Preview</span>
	</div>
	{#if screenOpen}
		<div data-ui="titlebar-center" data-tauri-drag-region></div>
	{:else}
		<div data-ui="titlebar-center" data-tauri-drag-region>
			<span data-ui="project-dot" data-state={view.state}></span>
			<span>{view.workspaceName}</span>
			{#if activity.streaming}
				<StreamingIndicator {activity} compact />
			{:else}
				<span data-ui="muted">{view.subtitle}</span>
			{/if}
		</div>
	{/if}
	<div data-ui="titlebar-end">
		{#if !screenOpen}
			<Tooltip text={layout.darkTheme ? 'Use light theme' : 'Use dark theme'}>
				{#snippet children(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Toggle color theme"
						onclick={() => layout.toggleTheme()}
					>
						{#if layout.darkTheme}<Sun size={17} />{:else}<Moon
								size={17}
							/>{/if}
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
			{#if layout.rightMode === 'overlay'}
				<PanelToggle
					side="right"
					expanded={layout.rightVisible}
					onToggle={() => layout.toggleRight()}
				/>
			{/if}
		{/if}
		<WindowControls />
	</div>
</header>
