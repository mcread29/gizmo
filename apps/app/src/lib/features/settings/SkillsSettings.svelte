<script lang="ts">
	import { onMount } from 'svelte';
	import { FilePenLine, Search } from '@lucide/svelte';
	import type { SkillResource } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SettingsPage from './SettingsPage.svelte';
	import SkillDirectoryTree from './SkillDirectoryTree.svelte';
	import SkillEditor from './SkillEditor.svelte';
	import SkillList from './SkillList.svelte';

	let {
		store,
		dirty = $bindable(false),
	}: { store: AgentStore; dirty?: boolean } = $props();

	let query = $state('');
	let filter = $state<'all' | 'on' | 'off'>('all');
	let sort = $state<'directory' | 'name' | 'status'>('directory');
	let selectedId = $state<string>();

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'on', label: 'On' },
		{ value: 'off', label: 'Off' },
	] as const;

	onMount(() => void store.refreshResources());

	let all = $derived(store.resources?.skills ?? []);
	let matching = $derived(
		all
			.filter((skill) => {
				if (filter === 'on' && !skill.enabledGlobally) return false;
				if (filter === 'off' && skill.enabledGlobally) return false;
				const term = query.trim().toLowerCase();
				return (
					!term ||
					skill.name.toLowerCase().includes(term) ||
					skill.description.toLowerCase().includes(term)
				);
			})
			.sort((a, b) => {
				if (sort === 'status') {
					return (
						Number(b.enabledGlobally) - Number(a.enabledGlobally) ||
						a.name.localeCompare(b.name)
					);
				}
				if (sort === 'directory') {
					return (
						collectionRoot(a).localeCompare(collectionRoot(b)) ||
						a.name.localeCompare(b.name)
					);
				}
				return a.name.localeCompare(b.name);
			}),
	);
	let directoryGroups = $derived.by(() => {
		const groups: { source: string; skills: SkillResource[] }[] = [];
		for (const skill of matching) {
			const source = collectionRoot(skill);
			const existing = groups.find((group) => group.source === source);
			if (existing) existing.skills.push(skill);
			else groups.push({ source, skills: [skill] });
		}
		return groups
			.map(({ source, skills }) => ({
				source,
				label: directoryLabel(source),
				skills,
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	});
	let selected = $derived(all.find((skill) => skill.id === selectedId));
	let enabledCount = $derived(
		all.filter((skill) => skill.enabledGlobally).length,
	);

	function collectionRoot(skill: SkillResource) {
		if (skill.editable) return 'personal-skills';
		const normalized = skill.path.replaceAll('\\', '/');
		const parts = normalized.split('/');
		const extensionIndex = parts.lastIndexOf('extensions');
		if (
			extensionIndex >= 0 &&
			parts[extensionIndex + 1] &&
			parts[extensionIndex + 2]?.toLowerCase() === 'skills'
		) {
			return parts.slice(0, extensionIndex + 3).join('/');
		}
		return skill.source.replaceAll('\\', '/');
	}

	function directoryLabel(source: string) {
		if (source === 'personal-skills') return 'Personal skills';
		const parts = source.split('/').filter(Boolean);
		const leaf = parts.at(-1);
		return leaf?.toLowerCase() === 'skills'
			? (parts.at(-2) ?? leaf)
			: (leaf ?? source);
	}

	function toggle(skill: SkillResource, enabled: boolean) {
		void store.setGlobalSkill(skill.id, { enabled });
	}

	function install(skill: SkillResource, installed: boolean) {
		if (
			skill.id === selectedId &&
			dirty &&
			!confirm('Discard the unsaved changes and uninstall this skill?')
		) {
			return;
		}
		if (skill.id === selectedId && !installed) {
			dirty = false;
			selectedId = undefined;
		}
		void store.setGlobalSkill(skill.id, { installed });
	}

	function select(skill: SkillResource) {
		if (skill.id === selectedId) return;
		if (dirty && !confirm('Discard the unsaved changes to this skill?')) return;
		dirty = false;
		selectedId = skill.id;
	}

	function saved() {
		toasts.show('Skill Markdown saved', 'success');
	}

	function closeEditor() {
		if (dirty && !confirm('Discard the unsaved changes to this skill?')) return;
		dirty = false;
		selectedId = undefined;
	}

	function refresh() {
		if (dirty && !confirm('Discard unsaved changes and refresh the library?')) {
			return;
		}
		dirty = false;
		selectedId = undefined;
		void store.refreshResources();
	}

	function warnBeforeUnload(event: BeforeUnloadEvent) {
		if (!dirty) return;
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
		<p data-ui="resource-error">{store.resourceError}</p>
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
					<p data-ui="resource-empty">Loading skills…</p>
				{:else if all.length === 0}
					<p data-ui="resource-empty">No skills found on disk.</p>
				{:else if matching.length === 0}
					<p data-ui="resource-empty">No skills match this search.</p>
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
						bind:dirty
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
