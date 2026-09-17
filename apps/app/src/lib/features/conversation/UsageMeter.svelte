<script lang="ts">
	import type { CompactionPolicy, SessionUsage } from '@gizmo/protocol';
	import { Tooltip } from '../../components';
	import { usageView } from './usage';

	interface Props {
		usage: SessionUsage;
		/** The auto-compaction setting the meter is read against. */
		compaction?: CompactionPolicy;
		/** Compacts the thread; the meter is the only place the action lives. */
		onCompact: () => void;
		compactDisabled?: boolean;
	}

	let {
		usage,
		compaction,
		onCompact,
		compactDisabled = false,
	}: Props = $props();

	let view = $derived(usageView(usage, compaction));

	// A ring of radius 6 in a 16px box: the dash offset hides the unused arc.
	const radius = 6;
	const circumference = 2 * Math.PI * radius;
	let offset = $derived(circumference * (1 - Math.min(1, view.fraction ?? 0)));
	// The threshold is a tick on the ring, so the fill is read against where
	// compaction will actually happen rather than against the whole window.
	// The tick is drawn at the ring's start and rotated round by the share.
	let thresholdRotation = $derived(
		view.threshold === undefined ? undefined : view.threshold * 360 + 90,
	);
	let percentLabel = $derived(
		view.percent === undefined ? '' : ` (${Math.round(view.percent)}%)`,
	);
</script>

<Tooltip
	text={[
		`Context ${view.tokens}${percentLabel}`,
		view.policy,
		view.detail,
		'Click to compact now (older history is summarized)',
	]
		.filter(Boolean)
		.join(' · ')}
>
	{#snippet children(props)}
		<button
			{...props}
			type="button"
			data-ui="usage-meter"
			data-level={view.level}
			aria-label={`Context used: ${view.tokens}${percentLabel}. ${view.policy ? `${view.policy}. ` : ''}Compact context`}
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
				{#if thresholdRotation !== undefined}
					<line
						data-ui="usage-threshold"
						x1="8"
						y1="0.5"
						x2="8"
						y2="4.5"
						transform={`rotate(${thresholdRotation} 8 8)`}
					/>
				{/if}
			</svg>
		</button>
	{/snippet}
</Tooltip>
