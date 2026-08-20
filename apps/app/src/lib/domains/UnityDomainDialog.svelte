<script lang="ts">
	import type { AgentStore } from '../agent-client';
	import CompileConfirmationDialog from '../features/unity/CompileConfirmationDialog.svelte';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	let { store, layout }: { store: AgentStore; layout: WorkspaceLayout } =
		$props();
</script>

<CompileConfirmationDialog {store} {layout} />
