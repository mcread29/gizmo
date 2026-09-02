<script lang="ts">
	import type { AgentStore } from '../../../agent-client';
	import { ResourceNote } from '../../../components';
	import SkillList from '../../settings/SkillList.svelte';
	import ConfigureSectionHeading from './ConfigureSectionHeading.svelte';
	import type { ReapplyProjectConfig } from './types';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		onReapply: ReapplyProjectConfig;
	}

	let { store, workspacePath, onReapply }: Props = $props();

	// Skills are resolved per workspace, so a stale catalog must not be shown.
	let installedSkills = $derived(
		store.resources?.workspacePath === workspacePath
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	let projectSkills = $derived(
		installedSkills.filter((skill) => skill.scope === 'project'),
	);
	let globalSkills = $derived(
		installedSkills.filter((skill) => skill.scope === 'global'),
	);
	let overriddenSkills = $derived(
		new Set(
			installedSkills
				.filter((skill) => skill.override !== undefined)
				.map(({ id }) => id),
		),
	);
	let activeSkills = $derived(
		installedSkills.filter((skill) => skill.enabled).length,
	);

	function setSkill(id: string, enabled: boolean | null) {
		onReapply(store.setProjectSkill(workspacePath, id, enabled));
	}
</script>

<ConfigureSectionHeading
	title="Skills"
	description={`${activeSkills} of ${installedSkills.length} on. Each skill uses your global setting until you change it here.`}
/>
{#if store.resourceError}
	<ResourceNote tone="error">{store.resourceError}</ResourceNote>
{/if}
{#if projectSkills.length > 0}
	<p data-ui="config-skill-group">
		From extensions · default set by the extension
	</p>
	<div data-ui="settings-card">
		<SkillList
			skills={projectSkills}
			mode="workspace"
			busy={store.resourcesLoading}
			changed={overriddenSkills}
			onToggle={(skill) => setSkill(skill.id, !skill.enabled)}
			onReset={(skill) => setSkill(skill.id, null)}
		/>
	</div>
{/if}
{#if globalSkills.length > 0}
	<p data-ui="config-skill-group">Global · default is your global setting</p>
	<div data-ui="settings-card">
		<SkillList
			skills={globalSkills}
			mode="workspace"
			busy={store.resourcesLoading}
			changed={overriddenSkills}
			onToggle={(skill) => setSkill(skill.id, !skill.enabled)}
			onReset={(skill) => setSkill(skill.id, null)}
		/>
	</div>
{/if}
{#if installedSkills.length === 0 && !store.resourcesLoading}
	<div data-ui="settings-card">
		<ResourceNote>No skills are installed.</ResourceNote>
	</div>
{/if}
