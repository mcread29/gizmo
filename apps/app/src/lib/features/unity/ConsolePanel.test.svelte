<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import ConsolePanel from './ConsolePanel.svelte';

	let { store }: { store: AgentStore } = $props();
</script>

<Tooltip.Provider>
	<ConsolePanel {store} />
</Tooltip.Provider>
