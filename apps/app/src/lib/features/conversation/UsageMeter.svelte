<script lang="ts">
	import type { SessionUsage } from '@gizmo/protocol';
	import { usageView } from './usage';

	let { usage }: { usage: SessionUsage } = $props();

	let view = $derived(usageView(usage));
</script>

<span data-ui="usage-meter" data-level={view.level} title={view.detail}>
	{#if view.fraction !== undefined}
		<span
			data-ui="usage-bar"
			role="meter"
			aria-label="Context used"
			aria-valuenow={Math.round(view.fraction * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<span
				data-ui="usage-fill"
				style={`width:${Math.min(100, view.fraction * 100)}%`}
			></span>
		</span>
	{/if}
	<small>{view.tokens}</small>
</span>
