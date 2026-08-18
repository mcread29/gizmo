<script lang="ts">
	import type { AgentIdentity } from '@unity-agent/protocol';
	import {
		Moon,
		PanelLeft,
		PanelRight,
		Settings,
		Sparkles,
		Sun,
	} from '@lucide/svelte';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from './shortcuts';
	import type { WorkspaceLayout } from './workspace.svelte';
	import type { UnityView } from '../unity/unity-view';

	interface Props {
		agent: AgentIdentity;
		layout: WorkspaceLayout;
		view: UnityView;
		onOpenSettings: () => void;
	}

	let { agent, layout, view, onOpenSettings }: Props = $props();
</script>

<header data-ui="titlebar">
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
		<div data-ui="brand-mark"><Sparkles size={15} /></div>
		<strong>{agent.name}</strong>
		<span data-ui="preview-badge">Preview</span>
	</div>
	<div data-ui="titlebar-center">
		<span data-ui="project-dot" data-state={view.status?.state}></span>
		<span>{view.projectName}</span>
		<span data-ui="muted"
			>{view.version ? `Unity ${view.version}` : view.state}</span
		>
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
	</div>
</header>
