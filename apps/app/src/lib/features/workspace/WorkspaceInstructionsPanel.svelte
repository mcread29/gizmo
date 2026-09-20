<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import InstructionsEditor from '../settings/InstructionsEditor.svelte';
	import type { UnsavedChangesGuard } from '../settings/unsaved-changes.svelte';
	import WorkspaceToolPolicySection from './configure/WorkspaceToolPolicySection.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		guard: UnsavedChangesGuard;
	}

	let { store, workspacePath, guard }: Props = $props();
</script>

<!--
	The two settings that apply to everything the agent does here, and the only
	tab with a Save step: the editor's dirty flag feeds the screen's guard so
	leaving asks before dropping the draft.
-->
<InstructionsEditor
	{store}
	target="project-agents"
	{workspacePath}
	bind:dirty={guard.dirty}
	title="AGENTS.md"
	description="Instructions for every session in this workspace, alongside the global AGENTS.md. Takes effect for new threads or after Reload runtime."
/>
<WorkspaceToolPolicySection {store} {workspacePath} />
