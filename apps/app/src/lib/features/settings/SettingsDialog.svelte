<script lang="ts">
	import { Switch } from 'bits-ui';
	import {
		appColorSchemes,
		defaultAppSettings,
		getColorScheme,
		getThemeMode,
		getThemeVariant,
		type ColorScheme,
		type ThemeMode,
	} from '../../app-settings';
	import { Button, Dialog, SelectField, SwitchField } from '../../components';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';

	interface Props {
		open?: boolean;
		layout: WorkspaceLayout;
	}

	let { open = $bindable(false), layout }: Props = $props();

	let colorScheme = $derived(getColorScheme(layout.theme));
	let themeMode = $derived(getThemeMode(layout.theme));

	function selectTheme(scheme: ColorScheme, mode: ThemeMode) {
		layout.theme = getThemeVariant(scheme, mode);
	}

	function restoreDefaults() {
		layout.theme = defaultAppSettings.theme;
		layout.sendOnEnter = defaultAppSettings.sendOnEnter;
		layout.autoFollowOutput = defaultAppSettings.autoFollowOutput;
		layout.showThreadSidebar = defaultAppSettings.showThreadSidebar;
		layout.showUnityInspector = defaultAppSettings.showUnityInspector;
		layout.reset('sidebar');
		layout.reset('inspector');
	}
</script>

<Dialog
	bind:open
	title="Settings"
	description="Customize Unity Agent on this device"
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Open settings</button
		>
	{/snippet}
	<div data-ui="settings-form">
		<section data-ui="settings-section">
			<div data-ui="settings-section-header">
				<strong>Theme</strong>
				<span>Choose a color scheme and appearance.</span>
			</div>
			<div data-ui="theme-controls">
				<SelectField
					value={colorScheme}
					label="Color scheme"
					options={appColorSchemes}
					onValueChange={(value) => {
						const option = appColorSchemes.find(
							(candidate) => candidate.value === value,
						);
						if (option) selectTheme(option.value, themeMode);
					}}
				/>
				<div data-ui="theme-mode-toggle">
					<span data-state={themeMode === 'light' ? 'active' : 'inactive'}
						>Light</span
					>
					<Switch.Root
						data-ui="switch"
						checked={themeMode === 'dark'}
						aria-label="Dark appearance"
						onCheckedChange={(checked) =>
							selectTheme(colorScheme, checked ? 'dark' : 'light')}
					>
						<Switch.Thumb data-ui="switch-thumb" />
					</Switch.Root>
					<span data-state={themeMode === 'dark' ? 'active' : 'inactive'}
						>Dark</span
					>
				</div>
			</div>
		</section>

		<section data-ui="settings-section">
			<div data-ui="settings-section-header">
				<strong>Composer</strong>
				<span>Control message input and response behavior.</span>
			</div>
			<SwitchField
				bind:checked={layout.sendOnEnter}
				label="Send with Enter"
				description="Press Shift+Enter for a new line. When off, use Ctrl or Command+Enter to send."
			/>
			<SwitchField
				bind:checked={layout.autoFollowOutput}
				label="Follow agent output"
				description="Keep the newest response content in view while the agent is working."
			/>
		</section>

		<section data-ui="settings-section">
			<div data-ui="settings-section-header">
				<strong>Layout</strong>
				<span>Choose which workspace panels stay visible.</span>
			</div>
			<SwitchField
				bind:checked={layout.showThreadSidebar}
				label="Thread sidebar"
				description="Show recent threads beside the conversation."
			/>
			<SwitchField
				bind:checked={layout.showUnityInspector}
				label="Unity inspector"
				description="Show Editor status, diagnostics, and activity."
			/>
		</section>

		<section data-ui="settings-section">
			<div data-ui="settings-section-header">
				<strong>Keyboard</strong>
				<span>Shortcuts available anywhere in the workspace.</span>
			</div>
			<dl data-ui="shortcut-list">
				<div>
					<dt>New thread</dt>
					<dd><kbd>Ctrl/⌘ N</kbd></dd>
				</div>
				<div>
					<dt>Search threads</dt>
					<dd><kbd>Ctrl/⌘ K</kbd></dd>
				</div>
				<div>
					<dt>Focus composer</dt>
					<dd><kbd>Ctrl/⌘ Shift L</kbd></dd>
				</div>
				<div>
					<dt>Toggle threads</dt>
					<dd><kbd>Ctrl/⌘ B</kbd></dd>
				</div>
				<div>
					<dt>Toggle inspector</dt>
					<dd><kbd>Ctrl/⌘ Shift B</kbd></dd>
				</div>
				<div>
					<dt>Settings</dt>
					<dd><kbd>Ctrl/⌘ ,</kbd></dd>
				</div>
			</dl>
		</section>

		<div data-ui="settings-actions">
			<Button variant="secondary" size="sm" onclick={restoreDefaults}
				>Restore defaults</Button
			>
		</div>
	</div>
</Dialog>
