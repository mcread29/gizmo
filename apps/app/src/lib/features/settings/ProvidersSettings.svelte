<script lang="ts">
	import { Check, Copy, Search, Trash2 } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote, SettingField } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	$effect(() => {
		if (store.connection === 'connected' && store.providers.length === 0) {
			void store.registry.refreshProviders();
		}
	});

	let query = $state('');
	let drafts = $state<Record<string, string>>({});
	let savingId = $state<string | null>(null);
	let removingId = $state<string | null>(null);
	/** Set for a moment after a copy so the button can confirm it happened. */
	let copiedId = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let authenticated = $derived(
		store.providers.filter((provider) => provider.authenticated).length,
	);

	let sortedProviders = $derived(
		[...store.providers].sort(
			(left, right) =>
				Number(right.authenticated) - Number(left.authenticated) ||
				left.name.localeCompare(right.name),
		),
	);

	let visibleProviders = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return sortedProviders;
		return sortedProviders.filter(
			(provider) =>
				provider.name.toLowerCase().includes(needle) ||
				provider.id.toLowerCase().includes(needle),
		);
	});

	const draftOf = (providerId: string) => (drafts[providerId] ?? '').trim();

	async function reimport() {
		if (await store.registry.reimportPiAuth()) {
			toasts.show('Refreshed Pi authentication for new threads', 'success');
		}
	}

	async function saveKey(providerId: string, providerName: string) {
		const apiKey = draftOf(providerId);
		if (!apiKey) return;
		savingId = providerId;
		try {
			if (await store.registry.setProviderApiKey(providerId, apiKey)) {
				drafts[providerId] = '';
				toasts.show(`Saved API key for ${providerName}`, 'success');
			}
		} finally {
			savingId = null;
		}
	}

	async function removeKey(providerId: string, providerName: string) {
		removingId = providerId;
		try {
			if (await store.registry.removeProviderApiKey(providerId)) {
				drafts[providerId] = '';
				toasts.show(`Removed API key for ${providerName}`, 'success');
			}
		} finally {
			removingId = null;
		}
	}

	/** Puts the stored key on the clipboard; it is never rendered on screen. */
	async function copyKey(providerId: string, providerName: string) {
		try {
			await navigator.clipboard.writeText(
				await store.registry.readProviderApiKey(providerId),
			);
			copiedId = providerId;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedId = null), 1600);
		} catch (error) {
			toasts.show(
				error instanceof Error
					? error.message
					: `Could not copy the ${providerName} API key`,
				'danger',
			);
		}
	}
</script>

<SettingsPage title="Providers">
	{#snippet actions()}
		<div data-ui="provider-filter">
			<div data-ui="search-field">
				<Search size={13} />
				<input
					bind:value={query}
					placeholder="Filter"
					aria-label="Filter providers"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
		</div>
		<span data-ui="settings-page-count">
			{authenticated} of {store.providers.length} connected
		</span>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.providersLoading}
			onclick={() => void store.registry.refreshProviders()}
		>
			{store.providersLoading ? 'Loading…' : 'Reload'}
		</Button>
	{/snippet}

	{#if store.providerError}
		<ResourceNote tone="error">{store.providerError}</ResourceNote>
	{/if}

	<div data-ui="settings-card">
		{#if !store.providersLoading && store.providers.length === 0}
			<ResourceNote>No providers found.</ResourceNote>
		{:else if visibleProviders.length === 0}
			<ResourceNote>No provider matches “{query.trim()}”.</ResourceNote>
		{:else}
			<table data-ui="provider-table">
				<!-- Column widths live in CSS so a narrow viewport can drop one. -->
				<colgroup><col /><col /><col /><col /></colgroup>
				<thead>
					<tr>
						<th scope="col">Provider</th>
						<th scope="col" style="text-align: right">Models</th>
						<th scope="col">API key</th>
						<th scope="col"><span data-ui="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each visibleProviders as provider (provider.id)}
						{@const stored =
							provider.authenticated && provider.credentialType === 'api_key'}
						{@const dirty = draftOf(provider.id).length > 0}
						<tr>
							<th scope="row">
								<span data-ui="provider-line">
									<i
										data-ui="provider-dot"
										data-on={provider.authenticated}
										aria-hidden="true"
									></i>
									<span>{provider.name}</span>
									<!--
										The dot alone carries no meaning for a screen reader, and
										"Not configured" on thirty-eight rows carries none for
										anyone. Connected rows say where the credential came
										from; the rest say nothing and read as the default.
									-->
									{#if provider.authenticated}
										<em>{provider.source || 'connected'}</em>
									{:else}
										<span data-ui="sr-only">Not connected</span>
									{/if}
								</span>
							</th>
							<td data-ui="provider-models">{provider.modelCount}</td>
							<td data-ui="provider-credential">
								{#if provider.supportsApiKey}
									<input
										type="password"
										bind:value={drafts[provider.id]}
										placeholder={stored ? '••••••••••••••••' : 'Paste API key'}
										aria-label={stored
											? `Replace the ${provider.name} API key`
											: `${provider.name} API key`}
										autocomplete="off"
										spellcheck="false"
										onkeydown={(event) => {
											if (event.key !== 'Enter' || !dirty) return;
											event.preventDefault();
											void saveKey(provider.id, provider.name);
										}}
									/>
								{:else}
									<span
										>{provider.supportsOAuth
											? 'OAuth only'
											: 'No credential needed'}</span
									>
								{/if}
							</td>
							<td>
								<div data-ui="provider-actions">
									{#if dirty}
										<Button
											variant="primary"
											size="icon"
											title="Save API key"
											aria-label={`Save the ${provider.name} API key`}
											disabled={savingId === provider.id}
											onclick={() => void saveKey(provider.id, provider.name)}
										>
											<Check size={14} />
										</Button>
									{:else if stored}
										<!-- Holds Save's place so Copy and Remove do not
										     jump sideways on the first keystroke. -->
										<span data-ui="provider-slot"></span>
									{/if}
									{#if stored}
										<Button
											variant="ghost"
											size="icon"
											title="Copy API key"
											aria-label={`Copy the ${provider.name} API key`}
											onclick={() => void copyKey(provider.id, provider.name)}
										>
											{#if copiedId === provider.id}
												<Check size={14} />
											{:else}
												<Copy size={14} />
											{/if}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											title="Remove API key"
											aria-label={`Remove the ${provider.name} API key`}
											disabled={removingId === provider.id}
											onclick={() => void removeKey(provider.id, provider.name)}
										>
											<Trash2 size={14} />
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div data-ui="settings-card">
		<SettingField
			label="Refresh from Pi"
			description="Normal Gizmo mode imports ~/.pi/agent/auth.json; Pi Web reads it directly. Existing live threads keep their current runtime."
		>
			<Button
				variant="secondary"
				size="sm"
				disabled={store.providersLoading}
				onclick={() => void reimport()}
			>
				Refresh Pi auth
			</Button>
		</SettingField>
	</div>
</SettingsPage>
