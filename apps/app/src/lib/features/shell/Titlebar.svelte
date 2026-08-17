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
	import type { UnityView } from '../unity/unity-view';

	interface Props {
		agent: AgentIdentity;
		theme: 'light' | 'dark';
		view: UnityView;
		onToggleLeft: () => void;
		onToggleRight: () => void;
		onToggleTheme: () => void;
		onOpenSettings: () => void;
	}

	let {
		agent,
		theme,
		view,
		onToggleLeft,
		onToggleRight,
		onToggleTheme,
		onOpenSettings,
	}: Props = $props();
</script>

<header data-ui="titlebar">
	<div data-ui="titlebar-start">
		<Tooltip text="Toggle session sidebar">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle session sidebar"
					onclick={onToggleLeft}
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
		<Tooltip text={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle color theme"
					onclick={onToggleTheme}
				>
					{#if theme === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
				</Button>
			{/snippet}
		</Tooltip>
		<Button
			variant="ghost"
			size="icon"
			aria-label="Settings"
			onclick={onOpenSettings}><Settings size={17} /></Button
		>
		<Tooltip text="Toggle editor inspector">
			{#snippet children(props)}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label="Toggle editor inspector"
					onclick={onToggleRight}
				>
					<PanelRight size={17} />
				</Button>
			{/snippet}
		</Tooltip>
	</div>
</header>
