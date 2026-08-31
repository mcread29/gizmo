<script lang="ts">
	import { onMount } from 'svelte';
	import type { InstructionTarget } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';

	let {
		store,
		target,
		workspacePath,
		title,
		description,
		onSaved,
	}: {
		store: AgentStore;
		target: InstructionTarget;
		workspacePath?: string;
		title: string;
		description: string;
		onSaved?: () => void;
	} = $props();

	let path = $state('');
	let content = $state('');
	let savedContent = $state('');
	let exists = $state(false);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string>();
	let dirty = $derived(content !== savedContent);
	let lineCount = $derived(content ? content.split(/\r?\n/).length : 0);

	onMount(async () => {
		error = undefined;
		try {
			const file = await store.readInstructions(target, workspacePath);
			path = file.path;
			content = file.content;
			savedContent = file.content;
			exists = file.exists;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			loading = false;
		}
	});

	async function save() {
		saving = true;
		error = undefined;
		if (await store.writeInstructions(target, content, workspacePath)) {
			savedContent = content;
			exists = true;
			onSaved?.();
		} else {
			error = store.resourceError ?? 'Could not save the file.';
		}
		saving = false;
	}
</script>

<div data-ui="settings-card">
	<section data-ui="instructions-editor" aria-label={`Edit ${title}`}>
		<div data-ui="instructions-editor-header">
			<div data-ui="settings-section-header">
				<strong>
					{title}
					{#if dirty}<span
							data-ui="instructions-editor-dirty"
							aria-live="polite">Unsaved</span
						>{/if}
				</strong>
				<span>{description}</span>
			</div>
			<div data-ui="instructions-editor-actions">
				<Button
					variant="secondary"
					size="sm"
					disabled={loading || saving || !dirty}
					onclick={() => {
						content = savedContent;
					}}>Revert</Button
				>
				<Button
					size="sm"
					disabled={loading || saving || !dirty}
					onclick={() => void save()}>{saving ? 'Saving…' : 'Save'}</Button
				>
			</div>
		</div>

		{#if loading}
			<p data-ui="resource-empty" role="status">Loading…</p>
		{:else}
			<textarea
				value={content}
				oninput={(event) => {
					content = event.currentTarget.value;
				}}
				aria-label={`${title} Markdown`}
				spellcheck="false"
				disabled={saving}
				placeholder={exists ? '' : 'Not created yet — saving creates the file.'}
			></textarea>
		{/if}

		<footer data-ui="instructions-editor-footer">
			<span title={path}>{path}</span>
			<span>{lineCount} lines</span>
			{#if error}<strong role="alert">{error}</strong>{/if}
		</footer>
	</section>
</div>
