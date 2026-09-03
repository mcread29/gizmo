<script lang="ts">
	import type { AgentIdentity } from '@gizmo/protocol';
	import { ArrowLeft, Moon, Settings, Sun } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { BrandMark, Button, Tooltip } from '../../components';
	import StreamingIndicator from '../conversation/StreamingIndicator.svelte';
	import { streamingActivity } from '../conversation/streaming';
	import { shortcutHint } from './shortcuts';
	import PanelToggle from './PanelToggle.svelte';
	import type { WorkspaceLayout } from './workspace.svelte';
	import { webExtensions } from '../../extensions/registry.svelte';
	import { workspaceNameFromPath } from '../../extensions/workspace-label';
	import type { PiExtensionUiStore } from '../extension-ui/PiExtensionUiStore.svelte';

	interface Props {
		agent: AgentIdentity;
		layout: WorkspaceLayout;
		store: AgentStore;
		extensionUi?: PiExtensionUiStore;
		/**
		 * A full screen such as Settings covers the workspace. The bar then keeps
		 * only what still does something: identity, the theme toggle, and the
		 * window controls.
		 */
		screenOpen?: boolean;
		settingsOpen?: boolean;
		onOpenSettings: () => void;
		onCloseSettings: () => void;
	}

	let {
		agent,
		layout,
		store,
		extensionUi,
		screenOpen = false,
		settingsOpen = false,
		onOpenSettings,
		onCloseSettings,
	}: Props = $props();

	// Visible even when the conversation is scrolled away from the newest reply.
	let activity = $derived(
		streamingActivity(
			store.messages,
			store.sessionState,
			extensionUi?.workingFor(store.sessionId),
		),
	);

	let piStatuses = $derived(extensionUi?.statusesFor(store.sessionId) ?? []);
	let workspaceName = $derived(
		workspaceNameFromPath(store.selectedProjectPath) ?? 'Select a workspace',
	);
	let extensionSummary = $derived(
		store.enabledExtensionIds.length === 1
			? '1 extension'
			: `${store.enabledExtensionIds.length} extensions`,
	);

	let statusBarItems = $derived(
		webExtensions()
			.filter(({ id }) => store.enabledExtensionIds.includes(id))
			.flatMap(
				(definition) =>
					definition.statusBar?.({
						store,
						projectPath: store.selectedProjectPath,
					}) ?? [],
			),
	);
</script>

<!-- The window has no native decorations, so the bar itself moves it. -->
<header data-ui="titlebar">
	<div data-ui="titlebar-start">
		{#if settingsOpen}
			<Tooltip text="Back">
				{#snippet children(props)}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Back"
						onclick={onCloseSettings}
					>
						<ArrowLeft size={17} />
					</Button>
				{/snippet}
			</Tooltip>
		{:else if !screenOpen}
			<PanelToggle
				side="left"
				expanded={layout.leftVisible}
				onToggle={() => layout.toggleLeft()}
			/>
		{/if}
		<div data-ui="brand-mark">
			<BrandMark />
		</div>
		<strong>{agent.name}</strong>
		<span data-ui="preview-badge">Preview</span>
	</div>
	{#if screenOpen}
		<div data-ui="titlebar-center"></div>
	{:else}
		<div data-ui="titlebar-center">
			<span
				data-ui="project-dot"
				data-state={store.connection}
				role="img"
				aria-label={`Agent ${store.connection}`}
			></span>
			<span data-ui="titlebar-workspace">{workspaceName}</span>
			{#if activity.streaming}
				<StreamingIndicator {activity} compact />
			{:else}
				<span data-ui="muted">{extensionSummary}</span>
			{/if}
		</div>
	{/if}
	<div data-ui="titlebar-end">
		{#if !screenOpen}
			{#each piStatuses as status (`${status.runtimeId}:${status.request.key}`)}
				<span
					data-ui="pi-extension-status"
					title={status.request.text ?? undefined}
				>
					{status.request.text}
				</span>
			{/each}
			{#each statusBarItems as item (item.id)}
				{@const Icon = item.icon}
				<button
					type="button"
					data-ui="status-bar-item"
					data-tone={item.tone ?? 'default'}
					disabled={!item.onClick}
					onclick={item.onClick}
				>
					{#if Icon}<Icon size={13} />{/if}
					{item.label}
				</button>
			{/each}
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
			<PanelToggle
				side="right"
				expanded={layout.rightVisible}
				onToggle={() => layout.toggleRight()}
			/>
		{/if}
	</div>
</header>
