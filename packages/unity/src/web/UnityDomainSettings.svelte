<script lang="ts">
	import type { UnityLayout } from './host';
	let { layout }: { layout: UnityLayout } = $props();
</script>

<div data-ui="settings-card">
	<div data-ui="setting-field">
		<div>
			<strong>Unity compilation</strong>
			<span
				>What happens when an agent needs to compile while the Editor is in Play
				Mode.</span
			>
		</div>
		<label>When Play Mode is active
			<select bind:value={layout.compilePlayModePolicy}>
				<option value="ask">Ask</option><option value="stop">Stop Play Mode</option><option value="keep_playing">Keep playing</option>
			</select>
		</label>
	</div>
</div>
