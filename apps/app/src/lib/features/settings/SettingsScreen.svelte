<script lang="ts">
	import {
		ArrowLeft,
		FolderCog,
		Info,
		MessageSquare,
		Palette,
		Plug,
		Layers,
		Sparkles,
		KeyRound,
		Brain,
	} from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ScrollPanel } from '../../components';
	import type { SettingsPage as SettingsPageName } from '../../router.svelte';
	import { focusOnOpen } from '../shell/modal-screen';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import AboutSettings from './AboutSettings.svelte';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import ChatSettings from './ChatSettings.svelte';
	import ConnectionSettings from './ConnectionSettings.svelte';
	import ContextSettings from './ContextSettings.svelte';
	import MemorySettings from './MemorySettings.svelte';
	import SettingsNav, {
		type SettingsNavAction,
		type SettingsNavItem,
	} from './SettingsNav.svelte';
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
		onSelectPage: (page: SettingsPageName) => void;
		onOpenWorkspace: () => void;
	}

	let {
		open = false,
		guard,
		page,
		layout,
		store,
		onSelectPage,
		onOpenWorkspace,
	}: Props = $props();

	/*
	 * A phone has room for the nav or a page, not both. Opening Settings shows
	 * the nav; choosing a page replaces it, and Back returns to the list. Wider
	 * windows ignore this and show both.
	 */
	let phoneView = $state<'nav' | 'page'>('nav');
	$effect(() => {
		if (!open) phoneView = 'nav';
	});

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
		leave(() => {
			onSelectPage(next);
			phoneView = 'page';
		});
	const openWorkspace = () => leave(onOpenWorkspace);

	const resourcePages = [
		{ page: 'agent', label: 'Instructions & tools' },
		{ page: 'skills', label: 'Skills' },
		{ page: 'extensions', label: 'Extensions' },
	] as const satisfies ReadonlyArray<{
		page: SettingsPageName;
		label: string;
	}>;

	/*
	 * Grouped by what a change actually reaches, which is the first thing any
	 * settings page has to answer. It used to be one "This device" run holding
	 * machine-wide credentials and a workspace's memory, and every page then
	 * carried a subtitle correcting it; the groups say it once instead.
	 */
	let groups = $derived([
		{
			title: 'This device',
			items: [
				{ page: 'appearance', label: 'Appearance', icon: Palette },
				{ page: 'chat', label: 'Chat', icon: MessageSquare },
				{ page: 'context', label: 'Context', icon: Layers },
				{ page: 'connection', label: 'Connection', icon: Plug },
			] satisfies SettingsNavItem[],
		},
		{
			title: 'This machine',
			items: [
				{ page: 'providers', label: 'Providers', icon: KeyRound },
				/* The digest default is stored beside the credentials it needs,
				   in this machine's data directory. */
				{ page: 'memory', label: 'Memory', icon: Brain },
				{
					page: 'agent',
					label: 'Agent resources',
					icon: Sparkles,
					...(skillCount ? { badge: skillCount } : {}),
				},
			] satisfies SettingsNavItem[],
		},
		{
			title: 'This workspace',
			/* Nothing device-wide is scoped to one workspace; what is lives on
			   the workspace screen, and this is the way in. */
			items: [] satisfies SettingsNavItem[],
			action: {
				label: 'Workspace settings',
				icon: FolderCog,
				onSelect: openWorkspace,
			} satisfies SettingsNavAction,
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

		<div data-ui="settings-body" data-phone-view={phoneView}>
			<div data-ui="settings-sidebar">
				<SettingsNav {groups} current={page} onSelect={selectPage} />
			</div>

			{#snippet settingsContent()}
				<div data-ui="settings-content" data-page={page}>
					<Button
						data-ui="settings-back"
						variant="ghost"
						size="sm"
						onclick={() => leave(() => (phoneView = 'nav'))}
						><ArrowLeft size={15} /> All settings</Button
					>
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
						<ChatSettings {layout} {store} />
					{:else if page === 'context'}
						<ContextSettings {store} />
					{:else if page === 'memory'}
						<MemorySettings {store} />
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
						<AboutSettings {layout} {store} />
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
