<script lang="ts">
	import {
		appColorSchemes,
		getColorScheme,
		getThemeMode,
		getThemeVariant,
		systemThemeMode,
		type ColorScheme,
	} from '../../app-settings';
	import { SelectField } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { layout }: { layout: WorkspaceLayout } = $props();

	let scheme = $derived(getColorScheme(layout.theme));
	let mode = $derived(
		layout.followSystemTheme ? 'system' : getThemeMode(layout.theme),
	);

	const modes = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' },
	] as const;

	function selectScheme(value: ColorScheme) {
		layout.theme = getThemeVariant(
			value,
			layout.followSystemTheme ? systemThemeMode() : getThemeMode(layout.theme),
		);
	}

	function selectMode(value: (typeof modes)[number]['value']) {
		layout.followSystemTheme = value === 'system';
		layout.theme = getThemeVariant(
			scheme,
			value === 'system' ? systemThemeMode() : value,
		);
	}
</script>

<SettingsPage title="Appearance" scope="Stored on this device">
	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong>Color scheme</strong>
				<span>Applies to every window on this device.</span>
			</div>
			<SelectField
				value={scheme}
				label="Color scheme"
				options={appColorSchemes}
				onValueChange={(value) => {
					const option = appColorSchemes.find(
						(candidate) => candidate.value === value,
					);
					if (option) selectScheme(option.value);
				}}
			/>
		</div>
		<div data-ui="setting-field">
			<div>
				<strong>Appearance</strong>
				<span
					>System follows your operating system's light and dark setting.</span
				>
			</div>
			<div data-ui="segmented" role="group" aria-label="Appearance">
				{#each modes as option (option.value)}
					<button
						data-ui="segmented-option"
						data-state={mode === option.value ? 'active' : 'inactive'}
						aria-pressed={mode === option.value}
						onclick={() => selectMode(option.value)}>{option.label}</button
					>
				{/each}
			</div>
		</div>
	</div>
</SettingsPage>
