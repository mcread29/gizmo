<script lang="ts">
	import { agentToolPolicy } from '@unity-agent/protocol';
	import { FolderOpen } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, Dialog } from '../../components';

	interface Props {
		store: AgentStore;
		projectOpen?: boolean;
		settingsOpen?: boolean;
		renameOpen?: boolean;
		deleteOpen?: boolean;
		renameDraft?: string;
		onStartThread: (projectPath: string) => void | Promise<void>;
		onRename: () => void | Promise<void>;
		onDelete: () => void | Promise<void>;
	}

	let {
		store,
		projectOpen = $bindable(false),
		settingsOpen = $bindable(false),
		renameOpen = $bindable(false),
		deleteOpen = $bindable(false),
		renameDraft = $bindable(''),
		onStartThread,
		onRename,
		onDelete,
	}: Props = $props();
</script>

<Dialog
	bind:open={projectOpen}
	title="New thread"
	description="Choose the Unity workspace this thread can inspect and modify"
>
	{#snippet trigger(props)}<button
			{...props}
			data-ui="hidden-trigger"
			hidden
			tabindex="-1">New thread</button
		>{/snippet}
	<div data-ui="project-picker">
		{#if store.projectsLoading}
			<p data-ui="inspector-message">Loading registered projects…</p>
		{:else if store.projects.length === 0}
			<p data-ui="inspector-message">
				{store.projectError ?? 'No registered Unity projects found.'}
			</p>
		{:else}
			{#each store.projects as project (project.path)}
				<button
					data-ui="project-option"
					onclick={() => onStartThread(project.path)}
					><FolderOpen size={19} /><span
						><strong>{project.title}</strong><small>{project.path}</small></span
					></button
				>
			{/each}
		{/if}
	</div>
</Dialog>

<Dialog
	bind:open={settingsOpen}
	title="Agent settings"
	description="Runtime configuration loaded by the local Pi agent"
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Open settings</button
		>
	{/snippet}
	<div data-ui="settings-list">
		<div>
			<span>Provider</span><strong
				>{store.model?.provider ?? 'Pi default'}</strong
			>
		</div>
		<div>
			<span>Model</span><strong
				>{store.model?.id ?? 'Resolved on thread start'}</strong
			>
		</div>
		<div>
			<span>Thinking</span><strong
				>{store.model?.thinkingLevel ?? 'Default'}</strong
			>
		</div>
		<div><span>Authentication</span><strong>Managed by Pi</strong></div>
		<div>
			<span>Tools</span><strong
				>{(store.activeTools.length
					? store.activeTools
					: agentToolPolicy.tools
				).join(', ')}</strong
			>
		</div>
		<div><span>Approvals</span><strong>Full access</strong></div>
		<div><span>Installed extensions</span><strong>Disabled</strong></div>
		<p>
			Credentials stay in the local Pi configuration and are never sent to the
			browser. Start <code>pi</code>, then use <code>/login</code> to change accounts.
			The listed tools execute without approval prompts.
		</p>
	</div>
</Dialog>

<Dialog
	bind:open={renameOpen}
	title="Rename thread"
	description="Choose a name for this local thread"
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Rename thread</button
		>
	{/snippet}
	<form
		data-ui="dialog-form"
		onsubmit={(event) => {
			event.preventDefault();
			void onRename();
		}}
	>
		<label for="session-title">Thread name</label>
		<input id="session-title" bind:value={renameDraft} autocomplete="off" />
		<div data-ui="dialog-actions">
			<Button type="submit" variant="primary" disabled={!renameDraft.trim()}
				>Rename</Button
			>
		</div>
	</form>
</Dialog>

<Dialog
	bind:open={deleteOpen}
	title="Delete thread?"
	description="This permanently removes the local transcript."
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Delete thread</button
		>
	{/snippet}
	<div data-ui="dialog-actions">
		<Button variant="danger" onclick={onDelete}>Delete thread</Button>
	</div>
</Dialog>
