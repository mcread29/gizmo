<script lang="ts">
	import {
		appColorSchemes,
		getColorScheme,
		getThemeMode,
		getThemeVariant,
		systemThemeMode,
		type ColorScheme,
	} from '../../app-settings';
	import { SelectField, SettingField } from '../../components';
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

<SettingsPage title="Appearance">
	<div data-ui="settings-card">
		<SettingField label="Color scheme">
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
		</SettingField>
		<SettingField label="Light and dark">
			<div data-ui="segmented" role="group" aria-label="Light and dark">
				{#each modes as option (option.value)}
					<button
						data-ui="segmented-option"
						data-state={mode === option.value ? 'active' : 'inactive'}
						aria-pressed={mode === option.value}
						onclick={() => selectMode(option.value)}>{option.label}</button
					>
				{/each}
			</div>
		</SettingField>
	</div>
</SettingsPage>
