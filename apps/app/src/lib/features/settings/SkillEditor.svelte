<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import type { SkillResource } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let {
		skill,
		store,
		onSaved,
		onBack,
		readOnly = false,
		dirty = $bindable(false),
	}: {
		skill: SkillResource;
		store: AgentStore;
		onSaved?: () => void;
		onBack?: () => void;
		readOnly?: boolean;
		dirty?: boolean;
	} = $props();

	let content = $state('');
	let savedContent = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string>();

	onMount(async () => {
		loading = true;
		error = undefined;
		try {
			const file = await store.readSkill(skill.path);
			content = file.content;
			savedContent = file.content;
			dirty = false;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			loading = false;
		}
	});

	async function save() {
		saving = true;
		error = undefined;
		if (await store.writeSkill(skill.path, content)) {
			savedContent = content;
			dirty = false;
			onSaved?.();
		} else {
			error = store.resourceError ?? 'Could not save the skill.';
		}
		saving = false;
	}
</script>

<section
	data-ui="skill-editor"
	aria-label={`${readOnly ? 'View' : 'Edit'} ${skill.name}`}
>
	<header data-ui="skill-editor-header">
		{#if onBack}
			<Button
				data-ui="skill-editor-back"
				variant="ghost"
				size="icon"
				aria-label="Back to skill library"
				onclick={onBack}><ArrowLeft size={16} /></Button
			>
		{/if}
		<div data-ui="skill-editor-identity">
			<div>
				<h3>{skill.name}</h3>
				<em data-ui="resource-scope">{skill.scope}</em>
				{#if readOnly}<span data-ui="skill-editor-readonly">Read only</span
					>{/if}
				{#if dirty}<span data-ui="skill-editor-dirty" aria-live="polite"
						>Unsaved</span
					>{/if}
			</div>
			<p title={skill.path}>{skill.path}</p>
		</div>
		{#if !readOnly}
			<div data-ui="skill-editor-actions">
				<Button
					variant="secondary"
					size="sm"
					disabled={loading || saving || !dirty}
					onclick={() => {
						content = savedContent;
						dirty = false;
					}}>Revert</Button
				>
				<Button
					size="sm"
					disabled={loading || saving || !dirty || !content.trim()}
					onclick={() => void save()}
				>
					{saving ? 'Saving…' : 'Save skill'}
				</Button>
			</div>
		{/if}
	</header>

	{#if loading}
		<div data-ui="skill-editor-loading" role="status">Loading Markdown…</div>
	{:else}
		<textarea
			value={content}
			oninput={(event) => {
				content = event.currentTarget.value;
				dirty = content !== savedContent;
			}}
			aria-label="Skill Markdown"
			spellcheck="false"
			readonly={readOnly}
			disabled={saving}></textarea>
	{/if}

	{#if error}
		<strong data-ui="skill-editor-error" role="alert">{error}</strong>
	{/if}
</section>
