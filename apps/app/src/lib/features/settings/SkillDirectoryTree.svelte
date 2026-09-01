<script lang="ts">
	import type { SkillResource } from '@gizmo/protocol';
	import SkillDirectoryTree from './SkillDirectoryTree.svelte';
	import SkillList from './SkillList.svelte';

	interface Props {
		skills: SkillResource[];
		source: string;
		path?: string[];
		busy?: boolean;
		selectedId?: string;
		onSelect: (skill: SkillResource) => void;
		onToggle: (skill: SkillResource, enabled: boolean) => void;
		onInstall: (skill: SkillResource, installed: boolean) => void;
	}

	let {
		skills,
		source,
		path = [],
		busy = false,
		selectedId,
		onSelect,
		onToggle,
		onInstall,
	}: Props = $props();

	function directories(skill: SkillResource) {
		const normalizedSource = source.replaceAll('\\', '/').replace(/\/$/, '');
		const normalizedPath = skill.path.replaceAll('\\', '/');
		const relative = normalizedPath.startsWith(`${normalizedSource}/`)
			? normalizedPath.slice(normalizedSource.length + 1)
			: normalizedPath;
		const parts = relative.split('/').filter(Boolean);
		const file = parts.at(-1)?.toLowerCase();
		return file === 'skill.md' ? parts.slice(0, -2) : parts.slice(0, -1);
	}

	let direct = $derived(
		skills.filter((skill) => directories(skill).length === path.length),
	);
	let children = $derived.by(() => {
		const names: string[] = [];
		for (const skill of skills) {
			const name = directories(skill)[path.length];
			if (name && !names.includes(name)) names.push(name);
		}
		return names.sort((a, b) => a.localeCompare(b));
	});
</script>

{#if direct.length}
	<SkillList
		skills={direct}
		mode="global"
		{busy}
		{selectedId}
		{onSelect}
		{onToggle}
		{onInstall}
	/>
{/if}

{#each children as directory (directory)}
	{@const childPath = [...path, directory]}
	{@const childSkills = skills.filter(
		(skill) => directories(skill)[path.length] === directory,
	)}
	<details
		data-ui="skill-directory"
		open
		style:--directory-depth={path.length + 1}
	>
		<summary>
			<span>{directory}</span>
			<small>{childSkills.length}</small>
		</summary>
		<SkillDirectoryTree
			skills={childSkills}
			{source}
			path={childPath}
			{busy}
			{selectedId}
			{onSelect}
			{onToggle}
			{onInstall}
		/>
	</details>
{/each}
