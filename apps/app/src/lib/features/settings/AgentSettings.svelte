<script lang="ts">
	import { Search } from '@lucide/svelte';
	import type { SkillResource } from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import SettingsPage from './SettingsPage.svelte';
	import SkillList from './SkillList.svelte';

	let { store }: { store: AgentStore } = $props();

	let query = $state('');
	let filter = $state<'all' | 'on' | 'off'>('all');

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'on', label: 'On' },
		{ value: 'off', label: 'Off' },
	] as const;

	// The global page describes every workspace, so no workspace is passed.
	$effect(() => {
		if (!store.resources) void store.refreshResources();
	});

	let catalog = $derived(store.resources);
	let all = $derived(catalog?.skills ?? []);
	let matching = $derived(
		all.filter((skill) => {
			if (filter === 'on' && !skill.enabledGlobally) return false;
			if (filter === 'off' && skill.enabledGlobally) return false;
			const term = query.trim().toLowerCase();
			return (
				!term ||
				skill.name.toLowerCase().includes(term) ||
				skill.description.toLowerCase().includes(term)
			);
		}),
	);
	let groups = $derived([
		{
			scope: 'global' as const,
			title: 'Global',
			note: 'Found in your Gizmo and shared agent folders.',
			skills: matching.filter((skill) => skill.scope === 'global'),
		},
		{
			scope: 'project' as const,
			title: 'Project',
			note: 'Found inside a workspace. Still installed and managed here.',
			skills: matching.filter((skill) => skill.scope === 'project'),
		},
	]);
	let enabledCount = $derived(
		all.filter((skill) => skill.enabledGlobally).length,
	);

	let agentsFiles = $derived(catalog?.agentsFiles ?? []);
	let prompts = $derived(catalog?.prompts ?? []);

	function toggle(skill: SkillResource, enabled: boolean) {
		void store.setGlobalSkill(skill.id, { enabled });
	}

	function install(skill: SkillResource, installed: boolean) {
		void store.setGlobalSkill(skill.id, { installed });
	}
</script>

<SettingsPage title="Agent" scope="Applies to every workspace on this machine">
	{#snippet actions()}
		<span data-ui="settings-page-count"
			>{enabledCount} of {all.length} skills on</span
		>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.resourcesLoading}
			onclick={() => void store.refreshResources()}
			>{store.resourcesLoading ? 'Reloading…' : 'Reload'}</Button
		>
	{/snippet}

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<strong>AGENTS.md</strong>
			<span>Instructions applied to every session. Edit these on disk.</span>
		</div>
		{#if agentsFiles.length === 0}
			<p data-ui="resource-empty">Nothing found.</p>
		{:else}
			<div data-ui="resource-list">
				{#each agentsFiles as resource (resource.id)}
					<div data-ui="resource-row">
						<strong>
							{resource.name}
							<em data-ui="resource-scope">{resource.scope}</em>
						</strong>
						{#if resource.description}<span>{resource.description}</span>{/if}
						<small title={resource.path}>{resource.path}</small>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div data-ui="settings-subhead">
		<strong>Skills</strong>
		<span
			>Every skill found in your Gizmo folders is installed here and starts off.
			A workspace can override any of these from its own settings.</span
		>
	</div>

	<div data-ui="skill-toolbar">
		<div data-ui="search-field">
			<Search size={15} />
			<input
				bind:value={query}
				placeholder="Search skills"
				aria-label="Search skills"
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
		<div data-ui="segmented" role="group" aria-label="Filter skills">
			{#each filters as option (option.value)}
				<button
					data-ui="segmented-option"
					data-state={filter === option.value ? 'active' : 'inactive'}
					aria-pressed={filter === option.value}
					onclick={() => (filter = option.value)}>{option.label}</button
				>
			{/each}
		</div>
	</div>

	{#if store.resourceError}
		<p data-ui="resource-error">{store.resourceError}</p>
	{/if}

	{#if store.resourcesLoading && !catalog}
		<div data-ui="skeleton" data-shape="workspace-card"></div>
	{:else}
		{#each groups as group (group.scope)}
			{#if group.skills.length}
				<div data-ui="settings-card">
					<div data-ui="settings-section-header">
						<strong>{group.title}</strong>
						<span>{group.note}</span>
					</div>
					<SkillList
						skills={group.skills}
						mode="global"
						busy={store.resourcesLoading}
						onToggle={toggle}
						onInstall={install}
					/>
				</div>
			{/if}
		{/each}
		{#if matching.length === 0}
			<p data-ui="resource-empty">
				{all.length ? 'No skills match.' : 'No skills found on disk.'}
			</p>
		{/if}
	{/if}

	<div data-ui="settings-subhead">
		<strong>Prompts</strong>
		<span>Prompt templates available as commands. Edit these on disk.</span>
	</div>

	<div data-ui="settings-card">
		{#if prompts.length === 0}
			<p data-ui="resource-empty">Nothing found.</p>
		{:else}
			<div data-ui="resource-list">
				{#each prompts as resource (resource.id)}
					<div data-ui="resource-row">
						<strong>
							{resource.name}
							<em data-ui="resource-scope">{resource.scope}</em>
						</strong>
						{#if resource.description}<span>{resource.description}</span>{/if}
						<small title={resource.path}>{resource.path}</small>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if catalog?.diagnostics.length}
		<div data-ui="settings-card">
			<div data-ui="settings-section-header">
				<strong>Warnings</strong>
				<span>Reported while loading these resources.</span>
			</div>
			<div data-ui="resource-list">
				{#each catalog.diagnostics as diagnostic, index (index)}
					<div data-ui="resource-row"><span>{diagnostic}</span></div>
				{/each}
			</div>
		</div>
	{/if}
</SettingsPage>
