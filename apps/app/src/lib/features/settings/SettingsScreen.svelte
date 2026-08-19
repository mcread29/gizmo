<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { Slider, Switch } from 'bits-ui';
	import {
		appColorSchemes,
		compilePlayModePolicies,
		getColorScheme,
		getThemeMode,
		getThemeVariant,
		type ColorScheme,
		type ThemeMode,
	} from '../../app-settings';
	import type { AgentStore } from '../../agent-client';
	import {
		Button,
		ScrollPanel,
		SelectField,
		SwitchField,
	} from '../../components';
	import { toasts } from '../../toasts.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsSection from './SettingsSection.svelte';

	interface Props {
		open?: boolean;
		layout: WorkspaceLayout;
		store: AgentStore;
		onClose: () => void;
	}

	let { open = false, layout, store, onClose }: Props = $props();

	let endpointDraft = $state('');
	let applying = $state(false);
	let backButton = $state<HTMLButtonElement>();

	// Re-seeded each time the screen opens so it reflects the saved address.
	$effect(() => {
		if (open) {
			endpointDraft = layout.agentUrl;
			backButton?.focus();
		}
	});

	async function applyEndpoint() {
		applying = true;
		layout.agentUrl = endpointDraft.trim();
		try {
			await store.reconnectTo(layout.agentUrl);
			toasts.show(
				store.connection === 'connected'
					? 'Connected to the agent server'
					: 'Could not reach that address',
				store.connection === 'connected' ? 'success' : 'danger',
			);
		} finally {
			applying = false;
		}
	}

	let colorScheme = $derived(getColorScheme(layout.theme));
	let themeMode = $derived(getThemeMode(layout.theme));

	function selectTheme(scheme: ColorScheme, mode: ThemeMode) {
		layout.theme = getThemeVariant(scheme, mode);
	}

	function setCompactionRange(values: number[]) {
		const [retain, trigger] = values;
		if (retain === undefined || trigger === undefined || trigger - retain < 5)
			return;
		layout.compactionRetainPercent = retain;
		layout.autoCompactFillPercent = trigger;
	}

	const shortcuts = [
		['New thread', 'Ctrl/⌘ N'],
		['Search threads', 'Ctrl/⌘ K'],
		['Focus composer', 'Ctrl/⌘ Shift L'],
		['Toggle threads', 'Ctrl/⌘ B'],
		['Toggle inspector', 'Ctrl/⌘ Shift B'],
		['Session tree', 'Ctrl/⌘ Shift T'],
		['Settings', 'Ctrl/⌘ ,'],
	] as const;
</script>

{#if open}
	<section data-ui="settings-screen" aria-label="Settings">
		<header data-ui="settings-screen-header">
			<button bind:this={backButton} data-ui="settings-back" onclick={onClose}>
				<ArrowLeft size={15} />
				<span>Back</span>
			</button>
			<h1>Settings</h1>
			<span>Customize Gizmo on this device</span>
		</header>

		<ScrollPanel>
			<div data-ui="settings-form">
				<SettingsSection
					title="Theme"
					description="Choose a color scheme and appearance."
				>
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
				</SettingsSection>

				<SettingsSection
					title="Composer"
					description="Control message input and response behavior."
				>
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
				</SettingsSection>

				<SettingsSection
					title="Context compaction"
					description="Summarize older work before the model runs out of context."
				>
					<SwitchField
						bind:checked={layout.autoCompact}
						label="Auto-compact context"
						description="Compact automatically when context reaches the configured fill level."
					/>
					<div data-ui="setting-field" data-layout="stacked">
						<div>
							<strong>Context range</strong>
							<span
								>Compaction keeps complete turns up to the retained target.</span
							>
						</div>
						<div data-ui="context-range-values">
							<span
								><i data-kind="retain"></i>Retain {layout.compactionRetainPercent}%</span
							>
							<span
								><i data-kind="trigger"></i>Compact at {layout.autoCompactFillPercent}%</span
							>
						</div>
						<Slider.Root
							type="multiple"
							value={[
								layout.compactionRetainPercent,
								layout.autoCompactFillPercent,
							]}
							min={5}
							max={95}
							step={5}
							disabled={!layout.autoCompact}
							onValueChange={setCompactionRange}
							data-ui="context-range"
						>
							<Slider.Range data-ui="context-range-fill" />
							<Slider.Thumb
								index={0}
								data-ui="context-range-thumb"
								aria-label="Context retained"
							/>
							<Slider.Thumb
								index={1}
								data-ui="context-range-thumb"
								aria-label="Auto-compaction threshold"
							/>
						</Slider.Root>
					</div>
				</SettingsSection>

				<SettingsSection
					title="Unity compilation"
					description="Choose what happens when an agent needs to compile while the Editor is in Play Mode."
				>
					<SelectField
						value={layout.compilePlayModePolicy}
						label="When Play Mode is active"
						options={[...compilePlayModePolicies]}
						onValueChange={(value) => {
							if (
								value === 'ask' ||
								value === 'stop' ||
								value === 'keep_playing'
							) {
								layout.compilePlayModePolicy = value;
							}
						}}
					/>
				</SettingsSection>

				<SettingsSection
					title="Reasoning"
					description="How model reasoning appears above each reply."
				>
					<SwitchField
						bind:checked={layout.expandReasoning}
						label="Expand reasoning"
						description="Reasoning is often longer than the reply. When off, it stays folded behind a single line you can open."
					/>
				</SettingsSection>

				<SettingsSection
					title="Layout"
					description="Choose which workspace panels stay visible."
				>
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
				</SettingsSection>

				<SettingsSection
					title="Agent server"
					description="Leave empty to use the local sidecar. Changing this reconnects."
				>
					<div data-ui="endpoint-field">
						<label for="agent-url" data-ui="sr-only">Agent server address</label
						>
						<input
							id="agent-url"
							bind:value={endpointDraft}
							placeholder="ws://127.0.0.1:8787/agent"
							autocomplete="off"
							spellcheck="false"
						/>
						<Button
							variant="secondary"
							size="sm"
							disabled={applying || endpointDraft.trim() === layout.agentUrl}
							onclick={() => void applyEndpoint()}
							>{applying ? 'Connecting…' : 'Apply'}</Button
						>
					</div>
				</SettingsSection>

				<SettingsSection
					title="Keyboard"
					description="Shortcuts available anywhere in the workspace."
				>
					<dl data-ui="shortcut-list">
						{#each shortcuts as [label, keys] (label)}
							<div>
								<dt>{label}</dt>
								<dd><kbd>{keys}</kbd></dd>
							</div>
						{/each}
					</dl>
				</SettingsSection>

				<div data-ui="settings-actions">
					<Button
						variant="secondary"
						size="sm"
						onclick={() => layout.restoreDefaults()}>Restore defaults</Button
					>
				</div>
			</div>
		</ScrollPanel>
	</section>
{/if}
