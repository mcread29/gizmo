<script lang="ts">
	import { Switch } from 'bits-ui';

	interface Props {
		checked?: boolean;
		label: string;
		description: string;
	}

	let { checked = $bindable(false), label, description }: Props = $props();
</script>

<div data-ui="setting-field">
	<div>
		<strong>{label}</strong>
		<span>{description}</span>
	</div>
	<Switch.Root data-ui="switch" bind:checked aria-label={label}>
		<Switch.Thumb data-ui="switch-thumb" />
	</Switch.Root>
</div>
