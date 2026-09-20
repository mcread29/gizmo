<script lang="ts">
	import { Switch } from 'bits-ui';
	import SettingField from './SettingField.svelte';

	interface Props {
		checked?: boolean;
		label: string;
		description?: string;
	}

	let { checked = $bindable(false), label, description }: Props = $props();
</script>

<SettingField {label} {description}>
	<Switch.Root data-ui="switch" bind:checked aria-label={label}>
		<Switch.Thumb data-ui="switch-thumb" />
	</Switch.Root>
</SettingField>
