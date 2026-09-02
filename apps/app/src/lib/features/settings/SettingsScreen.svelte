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
	import { focusOnOpen } from '../shell/modal-screen';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import AboutSettings from './AboutSettings.svelte';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import ChatSettings from './ChatSettings.svelte';
	import ConnectionSettings from './ConnectionSettings.svelte';
	import ContextSettings from './ContextSettings.svelte';
	import SettingsNav, { type SettingsNavItem } from './SettingsNav.svelte';
	import AgentSettings from './AgentSettings.svelte';
	import ProvidersSettings from './ProvidersSettings.svelte';
	import ExtensionsSettings from './ExtensionsSettings.svelte';
	import SkillsSettings from './SkillsSettings.svelte';
	import {
		discardSkillChanges,
		type UnsavedChangesGuard,
	} from './unsaved-changes.svelte';

	interface Props {
		open?: boolean;
		guard: UnsavedChangesGuard;
		page: SettingsPageName;
		layout: WorkspaceLayout;
		store: AgentStore;
		version: string;
		onSelectPage: (page: SettingsPageName) => void;
		onOpenWorkspace: () => void;
	}

	let {
		open = false,
		guard,
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

	/** Leaving the skills page is the only navigation that can lose edits. */
	function leave(action: () => void) {
		if (page !== 'skills') {
			action();
			return;
		}
		guard.guard(discardSkillChanges, action);
	}

	const selectPage = (next: SettingsPageName) =>
		leave(() => onSelectPage(next));
	const openWorkspace = () => leave(onOpenWorkspace);

	const resourcePages = [
		{ page: 'agent', label: 'Instructions & tools' },
		{ page: 'skills', label: 'Skills' },
		{ page: 'extensions', label: 'Extensions' },
	] as const satisfies ReadonlyArray<{
		page: SettingsPageName;
		label: string;
	}>;

	let groups = $derived([
		{
			title: 'This device',
			items: [
				{ page: 'appearance', label: 'Appearance', icon: Palette },
				{ page: 'chat', label: 'Chat', icon: MessageSquare },
				{ page: 'context', label: 'Context', icon: Layers },
				{ page: 'connection', label: 'Connection', icon: Plug },
				{ page: 'providers', label: 'Providers', icon: KeyRound },
				{
					page: 'agent',
					label: 'Agent resources',
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
	<div
		data-ui="settings-screen"
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-screen-title"
		tabindex="-1"
		{@attach focusOnOpen}
	>
		<!--
			No visible "Settings" band: the titlebar already shows you left the
			workspace, the nav shows which page you are on, and the page's own
			heading names it — a third copy only cost vertical space. The heading
			stays as the screen's accessible name.
		-->
		<h1 id="settings-screen-title" data-ui="sr-only">Settings</h1>

		<div data-ui="settings-body">
			<div data-ui="settings-sidebar">
				<SettingsNav {groups} current={page} onSelect={selectPage} />
				<!-- Workspace configuration is its own screen; this is the way in. -->
				<button data-ui="settings-nav-item" onclick={openWorkspace}>
					<FolderCog size={15} />
					<span>Workspace settings</span>
				</button>
			</div>

			{#snippet settingsContent()}
				<div data-ui="settings-content" data-page={page}>
					{#if page === 'agent' || page === 'skills' || page === 'extensions'}
						<!--
							aria-current, not aria-pressed: these switch the page rather than
							toggle a setting, and data-state alone is invisible to assistive
							technology.
						-->
						<nav data-ui="segmented" aria-label="Agent resources">
							{#each resourcePages as resourcePage (resourcePage.page)}
								<button
									data-ui="segmented-option"
									data-state={page === resourcePage.page
										? 'active'
										: 'inactive'}
									aria-current={page === resourcePage.page ? 'page' : undefined}
									onclick={() => selectPage(resourcePage.page)}
									>{resourcePage.label}</button
								>
							{/each}
						</nav>
					{/if}
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
					{:else if page === 'skills'}
						<SkillsSettings {store} {guard} />
					{:else if page === 'extensions'}
						<ExtensionsSettings {store} />
					{:else}
						<AboutSettings {layout} {version} />
					{/if}
				</div>
			{/snippet}

			{#if page === 'skills'}
				<div data-ui="settings-fixed-viewport">
					{@render settingsContent()}
				</div>
			{:else}
				<ScrollPanel>
					{@render settingsContent()}
				</ScrollPanel>
			{/if}
		</div>
	</div>
{/if}
