<script lang="ts">
	import type { SessionUsage } from '@gizmo/protocol';
	import { Tooltip } from '../../components';
	import { usageView } from './usage';

	interface Props {
		usage: SessionUsage;
		/** Compacts the thread; the meter is the only place the action lives. */
		onCompact: () => void;
		compactDisabled?: boolean;
	}

	let { usage, onCompact, compactDisabled = false }: Props = $props();

	let view = $derived(usageView(usage));

	// A ring of radius 6 in a 16px box: the dash offset hides the unused arc.
	const radius = 6;
	const circumference = 2 * Math.PI * radius;
	let offset = $derived(circumference * (1 - Math.min(1, view.fraction ?? 0)));
</script>

<Tooltip
	text={`Context ${view.tokens} · ${view.detail} — click to compact (older history is summarized)`}
>
	{#snippet children(props)}
		<button
			{...props}
			type="button"
			data-ui="usage-meter"
			data-level={view.level}
			aria-label={`Context used: ${view.tokens}. Compact context`}
			disabled={compactDisabled}
			onclick={onCompact}
		>
			<svg
				data-ui="usage-ring"
				role="meter"
				aria-label="Context used"
				aria-valuenow={view.percent !== undefined
					? Math.round(view.percent)
					: 0}
				aria-valuemin={0}
				aria-valuemax={100}
				viewBox="0 0 16 16"
				width="16"
				height="16"
			>
				<circle cx="8" cy="8" r={radius} data-ui="usage-track" />
				<circle
					cx="8"
					cy="8"
					r={radius}
					data-ui="usage-fill"
					stroke-dasharray={circumference}
					stroke-dashoffset={offset}
				/>
			</svg>
		</button>
	{/snippet}
</Tooltip>
