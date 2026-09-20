<script lang="ts">
	import { Search } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { ResourceNote } from '../../components';
	import {
		groupByDirectory,
		matchingSkills,
		type SkillFilter,
		type SkillSort,
	} from '../settings/skill-groups';
	import SkillList from '../settings/SkillList.svelte';
	import ConfigureSectionHeading from './configure/ConfigureSectionHeading.svelte';
	import type { WorkspaceConfiguration } from './workspace-config.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		configuration: WorkspaceConfiguration;
	}

	let { store, workspacePath, configuration }: Props = $props();

	let query = $state('');
	let filter = $state<SkillFilter>('all');
	let sort = $state<SkillSort>('directory');

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'on', label: 'On' },
		{ value: 'off', label: 'Off' },
		{ value: 'overridden', label: 'Overridden' },
	] as const;

	// Skills are resolved per workspace, so a stale catalog must not be shown.
	let installed = $derived(
		store.resources?.workspacePath === workspacePath
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	let matching = $derived(
		matchingSkills(installed, query, filter, sort, 'workspace'),
	);
	let groups = $derived(groupByDirectory(matching));
	let overridden = $derived(
		new Set(
			installed
				.filter((skill) => skill.override !== undefined)
				.map(({ id }) => id),
		),
	);
	let activeSkills = $derived(
		installed.filter((skill) => skill.enabled).length,
	);

	function setSkill(id: string, enabled: boolean | null) {
		void configuration.reapply(
			store.setProjectSkill(workspacePath, id, enabled),
		);
	}
</script>

<ConfigureSectionHeading
	title="Skills"
	description={`${activeSkills} of ${installed.length} on. Each skill uses your global setting until you change it here.`}
/>

{#if store.resourceError}
	<ResourceNote tone="error">{store.resourceError}</ResourceNote>
{/if}

<!--
	A hundred rows is not a list you scroll looking for one skill, so the
	library controls from global Settings come along: search narrows, the
	Overridden filter answers "what did I change here?", and the directory
	grouping names who each skill came from.
-->
<div data-ui="workspace-skills-toolbar">
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

{#snippet list(skills: typeof matching)}
	<SkillList
		{skills}
		mode="workspace"
		busy={store.resourcesLoading}
		changed={overridden}
		onToggle={(skill) => setSkill(skill.id, !skill.enabled)}
		onReset={(skill) => setSkill(skill.id, null)}
	/>
{/snippet}

<div data-ui="settings-card">
	{#if store.resourcesLoading && installed.length === 0}
		<ResourceNote live>Loading skills…</ResourceNote>
	{:else if installed.length === 0}
		<ResourceNote>No skills are installed.</ResourceNote>
	{:else if matching.length === 0}
		<ResourceNote>No skills match this search.</ResourceNote>
	{:else if sort === 'directory'}
		{#each groups as group (group.source)}
			<details data-ui="skill-directory" open>
				<summary title={group.source}>
					<span>{group.label}</span>
					<small>{group.skills.length}</small>
				</summary>
				{@render list(group.skills)}
			</details>
		{/each}
	{:else}
		{@render list(matching)}
	{/if}
</div>
