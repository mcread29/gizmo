<script lang="ts">
	interface Props {
		title: string;
		description: string;
	}

	let { title, description }: Props = $props();
</script>

<div data-ui="config-zone-heading">
	<h2>{title}</h2>
	<span>{description}</span>
</div>
