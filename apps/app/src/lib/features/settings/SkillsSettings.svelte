<script lang="ts">
	import { onMount } from 'svelte';
	import { FilePenLine, Search } from '@lucide/svelte';
	import type { SkillResource } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SettingsPage from './SettingsPage.svelte';
	import SkillDirectoryTree from './SkillDirectoryTree.svelte';
	import SkillEditor from './SkillEditor.svelte';
	import SkillList from './SkillList.svelte';
	import {
		groupByDirectory,
		matchingSkills,
		type SkillFilter,
		type SkillSort,
	} from './skill-groups';
	import {
		discardSkillChanges,
		type UnsavedChangesGuard,
	} from './unsaved-changes.svelte';

	let { store, guard }: { store: AgentStore; guard: UnsavedChangesGuard } =
		$props();

	let query = $state('');
	let filter = $state<SkillFilter>('all');
	let sort = $state<SkillSort>('directory');
	let selectedId = $state<string>();

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'on', label: 'On' },
		{ value: 'off', label: 'Off' },
	] as const;

	onMount(() => void store.refreshResources());

	let all = $derived(store.resources?.skills ?? []);
	let matching = $derived(matchingSkills(all, query, filter, sort));
	let directoryGroups = $derived(groupByDirectory(matching));
	let selected = $derived(all.find((skill) => skill.id === selectedId));
	let enabledCount = $derived(
		all.filter((skill) => skill.enabledGlobally).length,
	);

	function toggle(skill: SkillResource, enabled: boolean) {
		void store.setGlobalSkill(skill.id, { enabled });
	}

	function install(skill: SkillResource, installed: boolean) {
		const apply = () => {
			if (skill.id === selectedId && !installed) selectedId = undefined;
			void store.setGlobalSkill(skill.id, { installed });
		};
		if (skill.id !== selectedId) {
			apply();
			return;
		}
		guard.guard('Discard the unsaved changes and uninstall this skill?', apply);
	}

	function select(skill: SkillResource) {
		if (skill.id === selectedId) return;
		guard.guard(discardSkillChanges, () => (selectedId = skill.id));
	}

	function saved() {
		toasts.show('Skill Markdown saved', 'success');
	}

	function closeEditor() {
		guard.guard(discardSkillChanges, () => (selectedId = undefined));
	}

	function refresh() {
		guard.guard('Discard unsaved changes and refresh the library?', () => {
			selectedId = undefined;
			void store.refreshResources();
		});
	}

	function warnBeforeUnload(event: BeforeUnloadEvent) {
		if (!guard.dirty) return;
		event.preventDefault();
		event.returnValue = '';
	}
</script>

<svelte:window onbeforeunload={warnBeforeUnload} />

<SettingsPage
	title="Skills"
	scope="Global Pi skills shared across your workspaces"
	hideHeader
>
	{#snippet actions()}
		<span data-ui="settings-page-count"
			>{store.resourcesLoading
				? 'Loading…'
				: `${enabledCount} of ${all.length} on`}</span
		>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.resourcesLoading}
			onclick={refresh}
			>{store.resourcesLoading ? 'Refreshing…' : 'Refresh'}</Button
		>
	{/snippet}

	{#if store.resourceError}
		<ResourceNote tone="error">{store.resourceError}</ResourceNote>
	{/if}

	<div data-ui="skills-workbench" data-selected={Boolean(selected)}>
		<aside data-ui="skills-library" aria-label="Skill library">
			<div data-ui="skills-library-toolbar">
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
				<div data-ui="skills-library-controls">
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
					<label data-ui="skill-sort">
						<span>Sort</span>
						<select bind:value={sort} aria-label="Sort skills">
							<option value="directory">Directory</option>
							<option value="name">Name</option>
							<option value="status">Status</option>
						</select>
					</label>
				</div>
			</div>

			<div data-ui="skills-library-list">
				{#if store.resourcesLoading && all.length === 0}
					<ResourceNote live>Loading skills…</ResourceNote>
				{:else if all.length === 0}
					<ResourceNote>No skills found on disk.</ResourceNote>
				{:else if matching.length === 0}
					<ResourceNote>No skills match this search.</ResourceNote>
				{:else if sort === 'directory'}
					{#each directoryGroups as group (group.source)}
						<details data-ui="skill-directory" open>
							<summary title={group.source}>
								<span>{group.label}</span>
								<small>{group.skills.length}</small>
							</summary>
							{#if group.source === 'personal-skills'}
								<SkillList
									skills={group.skills}
									mode="global"
									busy={store.resourcesLoading}
									{selectedId}
									onSelect={select}
									onToggle={toggle}
									onInstall={install}
								/>
							{:else}
								<SkillDirectoryTree
									skills={group.skills}
									source={group.source}
									busy={store.resourcesLoading}
									{selectedId}
									onSelect={select}
									onToggle={toggle}
									onInstall={install}
								/>
							{/if}
						</details>
					{/each}
				{:else}
					<SkillList
						skills={matching}
						mode="global"
						busy={store.resourcesLoading}
						{selectedId}
						onSelect={select}
						onToggle={toggle}
						onInstall={install}
					/>
				{/if}
			</div>
		</aside>

		<div data-ui="skills-editor-area">
			{#if selected}
				{#key selected.id}
					<SkillEditor
						skill={selected}
						{store}
						bind:dirty={guard.dirty}
						readOnly={!selected.editable}
						onBack={closeEditor}
						onSaved={saved}
					/>
				{/key}
			{:else}
				<div data-ui="skill-editor-empty">
					<FilePenLine size={22} strokeWidth={1.5} />
					<strong>Select a skill to edit</strong>
					<span>Choose a skill to view its Markdown.</span>
				</div>
			{/if}
		</div>
	</div>
</SettingsPage>
