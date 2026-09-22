<script lang="ts">
	import type { AgentModelOption } from '@gizmo/protocol';
	import { SelectField, SwitchField } from '../components';
	import type { AgentStore } from '../agent-client';
	import { toasts } from '../toasts.svelte';
	import ExtensionModelField from './ExtensionModelField.svelte';
	import { extensionUi } from './extension-ui.svelte';

	let { store, extensionId }: { store: AgentStore; extensionId: string } =
		$props();

	/**
	 * Settings live on the server, so the catalog already carries the current
	 * values and every client re-renders from the broadcast. Edits in flight
	 * are held locally so an incoming event cannot fight the caret.
	 */
	let extension = $derived(
		extensionUi.extensions.find(({ id }) => id === extensionId),
	);
	let fields = $derived(extension?.settings ?? []);
	let pending = $state<Record<string, unknown>>({});
	let values = $derived({ ...(extension?.settingsValues ?? {}), ...pending });
	let timers = new Map<string, ReturnType<typeof setTimeout>>();

	let needsModels = $derived(fields.some((field) => field.kind === 'model'));
	let models = $state<AgentModelOption[]>([]);
	let thinkingLevels = $state<string[]>([]);
	$effect(() => {
		if (!needsModels || models.length) return;
		void store.extensions
			.globalModelCatalog()
			.then((catalog) => {
				models = catalog.models;
				thinkingLevels = catalog.thinkingLevels;
			})
			.catch((error: unknown) => console.warn('No model catalog', error));
	});

	/** Text and numbers settle before they are sent; everything else is sent now. */
	function save(key: string, value: unknown, debounceMs = 0) {
		pending = { ...pending, [key]: value };
		clearTimeout(timers.get(key));
		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key);
				void store.extensions
					.setExtensionSettings(extensionId, { [key]: value })
					.then(() => {
						const { [key]: _saved, ...rest } = pending;
						pending = rest;
					})
					.catch((error: unknown) => {
						toasts.show(
							error instanceof Error ? error.message : 'Could not save setting',
							'danger',
						);
					});
			}, debounceMs),
		);
	}

	function text(value: unknown): string {
		return typeof value === 'string' ? value : '';
	}
</script>

{#if fields.length}
	<section data-ui="extension-settings">
		{#each fields as field (field.key)}
			{#if field.kind === 'boolean'}
				<SwitchField
					label={field.label}
					description={field.description ?? ''}
					bind:checked={
						() => values[field.key] === true,
						(checked) => save(field.key, checked)
					}
				/>
			{:else if field.kind === 'select'}
				<SelectField
					label={field.label}
					options={field.options}
					value={text(values[field.key])}
					onValueChange={(value) => save(field.key, value)}
				/>
			{:else if field.kind === 'model'}
				<ExtensionModelField
					label={field.label}
					description={field.description}
					thinking={field.thinking ?? false}
					value={values[field.key]}
					{models}
					{thinkingLevels}
					onChange={(value) => save(field.key, value)}
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
							value={typeof values[field.key] === 'number'
								? values[field.key]
								: ''}
							oninput={(event) =>
								save(
									field.key,
									event.currentTarget.value === ''
										? null
										: Number(event.currentTarget.value),
									400,
								)}
						/>
					{:else}
						<input
							type="text"
							placeholder={field.placeholder}
							value={text(values[field.key])}
							oninput={(event) =>
								save(
									field.key,
									event.currentTarget.value === ''
										? null
										: event.currentTarget.value,
									400,
								)}
						/>
					{/if}
				</label>
			{/if}
		{/each}
	</section>
{/if}

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	label {
		display: grid;
		gap: var(--space-1);
	}
	small {
		color: var(--color-text-muted);
	}
</style>
