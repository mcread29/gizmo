<script lang="ts">
	import type { SessionUsage } from '@gizmo/protocol';
	import { usageView } from './usage';

	let { usage }: { usage: SessionUsage } = $props();

	let view = $derived(usageView(usage));
</script>

<span data-ui="usage-meter" data-level={view.level} title={view.detail}>
	<span
		data-ui="usage-bar"
		role="meter"
		aria-label="Context used"
		aria-valuenow={view.percent !== undefined ? Math.round(view.percent) : 0}
		aria-valuemin={0}
		aria-valuemax={100}
	>
		<span
			data-ui="usage-fill"
			style={`transform:scaleX(${view.fraction !== undefined ? Math.min(1, view.fraction) : 0})`}
		></span>
	</span>
	<small>
		{#if view.percent !== undefined}{view.percent}% ·
		{/if}{view.tokens}
	</small>
</span>
