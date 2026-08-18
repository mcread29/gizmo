<script lang="ts">
	import { FolderOpen } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { AgentStore } from '../../agent-client';
	import {
		appColorSchemes,
		defaultAppSettings,
		getColorScheme,
		getThemeMode,
		getThemeVariant,
		type AppTheme,
		type ColorScheme,
		type ThemeMode,
	} from '../../app-settings';
	import { Button, Dialog, SelectField, SwitchField } from '../../components';

	interface Props {
		store: AgentStore;
		projectOpen?: boolean;
		settingsOpen?: boolean;
		theme?: AppTheme;
		sendOnEnter?: boolean;
		autoFollowOutput?: boolean;
		showThreadSidebar?: boolean;
		showUnityInspector?: boolean;
		renameOpen?: boolean;
		deleteOpen?: boolean;
		renameDraft?: string;
		onStartThread: (projectPath: string) => void | Promise<void>;
		onRename: () => void | Promise<void>;
		onDelete: () => void | Promise<void>;
	}

	let {
		store,
		projectOpen = $bindable(false),
		settingsOpen = $bindable(false),
		theme = $bindable(defaultAppSettings.theme),
		sendOnEnter = $bindable(defaultAppSettings.sendOnEnter),
		autoFollowOutput = $bindable(defaultAppSettings.autoFollowOutput),
		showThreadSidebar = $bindable(defaultAppSettings.showThreadSidebar),
		showUnityInspector = $bindable(defaultAppSettings.showUnityInspector),
		renameOpen = $bindable(false),
		deleteOpen = $bindable(false),
		renameDraft = $bindable(''),
		onStartThread,
		onRename,
		onDelete,
	}: Props = $props();
	let colorScheme = $derived(getColorScheme(theme));
	let themeMode = $derived(getThemeMode(theme));

	function selectColorScheme(scheme: ColorScheme) {
		theme = getThemeVariant(scheme, themeMode);
	}

	function selectThemeMode(mode: ThemeMode) {
		theme = getThemeVariant(colorScheme, mode);
	}

	function restoreDefaults() {
		theme = defaultAppSettings.theme;
		sendOnEnter = defaultAppSettings.sendOnEnter;
		autoFollowOutput = defaultAppSettings.autoFollowOutput;
		showThreadSidebar = defaultAppSettings.showThreadSidebar;
		showUnityInspector = defaultAppSettings.showUnityInspector;
	}
</script>

<Dialog
	bind:open={projectOpen}
	title="New thread"
	description="Choose the Unity workspace this thread can inspect and modify"
>
	{#snippet trigger(props)}<button
			{...props}
			data-ui="hidden-trigger"
			hidden
			tabindex="-1">New thread</button
		>{/snippet}
	<div data-ui="project-picker">
		{#if store.projectsLoading}
			<p data-ui="inspector-message">Loading registered projects…</p>
		{:else if store.projects.length === 0}
			<p data-ui="inspector-message">
				{store.projectError ?? 'No registered Unity projects found.'}
			</p>
		{:else}
			{#each store.projects as project (project.path)}
				<button
					data-ui="project-option"
					onclick={() => onStartThread(project.path)}
					><FolderOpen size={19} /><span
						><strong>{project.title}</strong><small>{project.path}</small></span
					></button
				>
			{/each}
		{/if}
	</div>
</Dialog>

<Dialog
	bind:open={settingsOpen}
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
						if (option) selectColorScheme(option.value);
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
							selectThemeMode(checked ? 'dark' : 'light')}
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
				bind:checked={sendOnEnter}
				label="Send with Enter"
				description="Press Shift+Enter for a new line. When off, use Ctrl or Command+Enter to send."
			/>
			<SwitchField
				bind:checked={autoFollowOutput}
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
				bind:checked={showThreadSidebar}
				label="Thread sidebar"
				description="Show recent threads beside the conversation."
			/>
			<SwitchField
				bind:checked={showUnityInspector}
				label="Unity inspector"
				description="Show Editor status, diagnostics, and activity."
			/>
		</section>

		<div data-ui="settings-actions">
			<Button variant="secondary" size="sm" onclick={restoreDefaults}
				>Restore defaults</Button
			>
		</div>
	</div>
</Dialog>

<Dialog
	bind:open={renameOpen}
	title="Rename thread"
	description="Choose a name for this local thread"
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Rename thread</button
		>
	{/snippet}
	<form
		data-ui="dialog-form"
		onsubmit={(event) => {
			event.preventDefault();
			void onRename();
		}}
	>
		<label for="session-title">Thread name</label>
		<input id="session-title" bind:value={renameDraft} autocomplete="off" />
		<div data-ui="dialog-actions">
			<Button type="submit" variant="primary" disabled={!renameDraft.trim()}
				>Rename</Button
			>
		</div>
	</form>
</Dialog>

<Dialog
	bind:open={deleteOpen}
	title="Delete thread?"
	description="This permanently removes the local transcript."
>
	{#snippet trigger(props)}
		<button {...props} data-ui="hidden-trigger" hidden tabindex="-1"
			>Delete thread</button
		>
	{/snippet}
	<div data-ui="dialog-actions">
		<Button variant="danger" onclick={onDelete}>Delete thread</Button>
	</div>
</Dialog>
