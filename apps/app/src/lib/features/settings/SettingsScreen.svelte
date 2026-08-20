<script lang="ts">
	import {
		FolderCog,
		Info,
		MessageSquare,
		Palette,
		Plug,
		Layers,
		Sparkles,
		KeyRound,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { ScrollPanel } from '../../components';
	import type { SettingsPage as SettingsPageName } from '../../router.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import AboutSettings from './AboutSettings.svelte';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import ChatSettings from './ChatSettings.svelte';
	import ConnectionSettings from './ConnectionSettings.svelte';
	import ContextSettings from './ContextSettings.svelte';
	import SettingsNav, { type SettingsNavItem } from './SettingsNav.svelte';
	import AgentSettings from './AgentSettings.svelte';
	import ProvidersSettings from './ProvidersSettings.svelte';

	interface Props {
		open?: boolean;
		page: SettingsPageName;
		layout: WorkspaceLayout;
		store: AgentStore;
		version: string;
		onSelectPage: (page: SettingsPageName) => void;
		onOpenWorkspace: () => void;
	}

	let {
		open = false,
		page,
		layout,
		store,
		version,
		onSelectPage,
		onOpenWorkspace,
	}: Props = $props();

	let skillCount = $derived(
		store.resources?.skills.filter((skill) => skill.enabledGlobally).length,
	);

	let groups = $derived([
		{
			title: 'This device',
			items: [
				{ page: 'appearance', label: 'Appearance', icon: Palette },
				{ page: 'chat', label: 'Chat', icon: MessageSquare },
				{ page: 'context', label: 'Context', icon: Layers },
				{ page: 'connection', label: 'Connection', icon: Plug },
				{ page: 'providers', label: 'Providers', icon: KeyRound },
			] satisfies SettingsNavItem[],
		},
		{
			items: [
				{
					page: 'agent',
					label: 'Agent',
					icon: Sparkles,
					...(skillCount ? { badge: skillCount } : {}),
				},
			] satisfies SettingsNavItem[],
		},
		{
			title: 'Gizmo',
			items: [
				{ page: 'about', label: 'About', icon: Info },
			] satisfies SettingsNavItem[],
		},
	]);
</script>

{#if open}
	<section data-ui="settings-screen" aria-label="Settings">
		<header data-ui="settings-screen-header">
			<h1>Settings</h1>
		</header>

		<div data-ui="settings-body">
			<div data-ui="settings-sidebar">
				<SettingsNav {groups} current={page} onSelect={onSelectPage} />
				<!-- Workspace configuration is its own screen; this is the way in. -->
				<button data-ui="settings-nav-item" onclick={onOpenWorkspace}>
					<FolderCog size={15} />
					<span>Workspace settings</span>
				</button>
			</div>

			<ScrollPanel>
				<div data-ui="settings-content">
					{#if page === 'appearance'}
						<AppearanceSettings {layout} />
					{:else if page === 'chat'}
						<ChatSettings {layout} />
					{:else if page === 'context'}
						<ContextSettings {layout} />
					{:else if page === 'connection'}
						<ConnectionSettings {layout} {store} />
					{:else if page === 'agent'}
						<AgentSettings {store} />
					{:else if page === 'providers'}
						<ProvidersSettings {store} />
					{:else}
						<AboutSettings {layout} {version} />
					{/if}
				</div>
			</ScrollPanel>
		</div>
	</section>
{/if}
