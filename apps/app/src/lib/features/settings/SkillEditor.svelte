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
		dirty = $bindable(false),
	}: {
		skill: SkillResource;
		store: AgentStore;
		onSaved?: () => void;
		onBack?: () => void;
		dirty?: boolean;
	} = $props();

	let content = $state('');
	let savedContent = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string>();
	let lineCount = $derived(content ? content.split(/\r?\n/).length : 0);

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

<section data-ui="skill-editor" aria-label={`Edit ${skill.name}`}>
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
				{#if dirty}<span data-ui="skill-editor-dirty" aria-live="polite"
						>Unsaved</span
					>{/if}
			</div>
			<p title={skill.path}>{skill.path}</p>
		</div>
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
			disabled={saving}></textarea>
	{/if}

	<footer data-ui="skill-editor-footer">
		<span>Markdown</span>
		<span>{lineCount} lines</span>
		{#if error}<strong role="alert">{error}</strong>{/if}
	</footer>
</section>
