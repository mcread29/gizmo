<script lang="ts">
	import logo from '../../assets/gizmo-logo.svg';

	interface Props {
		size?: number;
	}

	let { size = 26 }: Props = $props();
</script>

<img src={logo} width={size} height={size} alt="" aria-hidden="true" />
