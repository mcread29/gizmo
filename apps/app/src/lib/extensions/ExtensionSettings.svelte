<script lang="ts">
	import { SelectField } from '@gizmo/ui';
	import { SwitchField } from '../components';
	import type { WorkspaceLayout } from '../features/shell/workspace.svelte';
	import { extensionUi } from './extension-ui.svelte';

	let {
		layout,
		enabledExtensionIds,
	}: { layout: WorkspaceLayout; enabledExtensionIds: string[] } = $props();

	// The catalog is already scoped to the workspace, but Settings is also
	// reachable with a different workspace selected, so filter again.
	let forms = $derived(
		extensionUi
			.settingsFields()
			.filter(({ extensionId }) => enabledExtensionIds.includes(extensionId)),
	);

	function text(value: unknown): string {
		return typeof value === 'string' ? value : '';
	}
</script>

{#each forms as form (form.extensionId)}
	{@const settings = layout.settingsFor(form.extensionId)}
	<section data-ui="extension-settings">
		<h3>{form.extensionName}</h3>
		{#each form.value as field (field.key)}
			{#if field.kind === 'boolean'}
				<SwitchField
					label={field.label}
					description={field.description ?? ''}
					bind:checked={
						() => settings.get(field.key) === true,
						(checked) => settings.set(field.key, checked)
					}
				/>
			{:else if field.kind === 'select'}
				<SelectField
					label={field.label}
					options={field.options}
					value={text(settings.get(field.key))}
					onValueChange={(value) => settings.set(field.key, value)}
				/>
			{:else}
				<label data-ui="extension-settings-field">
					<span>{field.label}</span>
					{#if field.description}<small>{field.description}</small>{/if}
					{#if field.kind === 'number'}
						<input
							type="number"
							min={field.min}
							max={field.max}
							value={settings.get(field.key) ?? ''}
							oninput={(event) =>
								settings.set(
									field.key,
									event.currentTarget.value === ''
										? undefined
										: Number(event.currentTarget.value),
								)}
						/>
					{:else}
						<input
							type="text"
							placeholder={field.placeholder}
							value={text(settings.get(field.key))}
							oninput={(event) =>
								settings.set(field.key, event.currentTarget.value)}
						/>
					{/if}
				</label>
			{/if}
		{/each}
	</section>
{/each}

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	h3 {
		margin: 0;
		font-size: var(--text-base);
		font-weight: 600;
	}
	label {
		display: grid;
		gap: var(--space-1);
	}
	small {
		color: var(--color-text-muted);
	}
</style>
