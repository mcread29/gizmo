<script lang="ts">
	import {
		PanelLeft,
		PanelLeftClose,
		PanelRight,
		PanelRightClose,
	} from '@lucide/svelte';
	import { Button, Tooltip } from '../../components';
	import { shortcutHint } from './shortcuts';

	interface Props {
		side: 'left' | 'right';
		/** Whether the panel this controls is currently open. */
		expanded: boolean;
		onToggle: () => void;
	}

	let { side, expanded, onToggle }: Props = $props();

	let label = $derived(
		side === 'left' ? 'Toggle thread sidebar' : 'Toggle workspace inspector',
	);
	let hint = $derived(
		`${expanded ? 'Hide' : 'Show'} ${side === 'left' ? 'thread sidebar' : 'workspace inspector'} · ${shortcutHint(side === 'left' ? 'B' : '⇧B')}`,
	);
	let Icon = $derived(
		side === 'left'
			? expanded
				? PanelLeftClose
				: PanelLeft
			: expanded
				? PanelRightClose
				: PanelRight,
	);
</script>

<Tooltip text={hint}>
	{#snippet children(props)}
		<Button
			{...props}
			variant="ghost"
			size="icon"
			aria-label={label}
			aria-expanded={expanded}
			onclick={onToggle}
		>
			<Icon size={16} />
		</Button>
	{/snippet}
</Tooltip>
