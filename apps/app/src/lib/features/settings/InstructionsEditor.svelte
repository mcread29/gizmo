<script lang="ts">
	import { onMount } from 'svelte';
	import type { InstructionTarget } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';

	let {
		store,
		target,
		workspacePath,
		title,
		description,
		onSaved,
		workbench = false,
		dirty = $bindable(false),
	}: {
		store: AgentStore;
		target: InstructionTarget;
		workspacePath?: string;
		title: string;
		description: string;
		onSaved?: () => void;
		workbench?: boolean;
		/**
		 * Reported outward so a screen can guard navigation away from unsaved
		 * edits. Bindable rather than derived internally: the owner needs to
		 * read it, and clearing it is how a discard confirmation takes effect.
		 */
		dirty?: boolean;
	} = $props();

	let path = $state('');
	let content = $state('');
	let savedContent = $state('');
	let exists = $state(false);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string>();
	let lineCount = $derived(content ? content.split(/\r?\n/).length : 0);

	/*
	 * `dirty` is the owner's handle on the draft: a screen that guards
	 * navigation clears it when the user picks Discard, and that has to
	 * actually discard. Without this the editor kept the abandoned text with
	 * Save greyed out, because nothing considered it unsaved any more.
	 */
	$effect(() => {
		if (!dirty && content !== savedContent) content = savedContent;
	});

	onMount(async () => {
		error = undefined;
		try {
			const file = await store.readInstructions(target, workspacePath);
			path = file.path;
			content = file.content;
			savedContent = file.content;
			dirty = false;
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
			dirty = false;
			exists = true;
			onSaved?.();
		} else {
			error = store.resourceError ?? 'Could not save the file.';
		}
		saving = false;
	}
</script>

<div data-ui="settings-card" data-workbench={workbench || undefined}>
	<section
		data-ui="instructions-editor"
		aria-label={`Edit ${title}`}
		data-workbench={workbench || undefined}
	>
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
						dirty = false;
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
			<ResourceNote live>Loading…</ResourceNote>
		{:else}
			<textarea
				value={content}
				oninput={(event) => {
					content = event.currentTarget.value;
					dirty = content !== savedContent;
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
