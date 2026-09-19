<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	$effect(() => {
		if (store.connection === 'connected' && store.providers.length === 0) {
			void store.refreshProviders();
		}
	});

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

	let drafts = $state<Record<string, string>>({});
	let savingId = $state<string | null>(null);
	let removingId = $state<string | null>(null);

	async function reimport() {
		if (await store.reimportPiAuth()) {
			toasts.show('Refreshed Pi authentication for new threads', 'success');
		}
	}

	async function saveKey(providerId: string, providerName: string) {
		const apiKey = (drafts[providerId] ?? '').trim();
		if (!apiKey) {
			toasts.show('Paste an API key first', 'danger');
			return;
		}
		savingId = providerId;
		try {
			if (await store.setProviderApiKey(providerId, apiKey)) {
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
			if (await store.removeProviderApiKey(providerId)) {
				drafts[providerId] = '';
				toasts.show(`Removed API key for ${providerName}`, 'success');
			}
		} finally {
			removingId = null;
		}
	}
</script>

<SettingsPage title="Providers" scope="Stored by Gizmo on this machine">
	{#snippet actions()}
		<span data-ui="settings-page-count">
			{authenticated} of {store.providers.length} authenticated
		</span>
		<Button
			variant="secondary"
			size="sm"
			disabled={store.providersLoading}
			onclick={() => void store.refreshProviders()}
		>
			{store.providersLoading ? 'Loading…' : 'Reload'}
		</Button>
	{/snippet}

	<div data-ui="settings-subhead">
		<strong>Model providers</strong>
		<span>Authentication and models discovered by Gizmo's Pi runtime.</span>
	</div>

	{#if store.providerError}
		<p data-ui="settings-note" data-tone="danger">{store.providerError}</p>
	{/if}

	<div data-ui="settings-card">
		{#if !store.providersLoading && store.providers.length === 0}
			<ResourceNote>No providers found.</ResourceNote>
		{:else}
			{#each sortedProviders as provider (provider.id)}
				<div data-ui="setting-field" data-layout="stacked">
					<div>
						<strong>{provider.name}</strong>
						<span>
							{provider.modelCount} models ·
							{provider.supportsOAuth && provider.supportsApiKey
								? 'OAuth or API key'
								: provider.supportsOAuth
									? 'OAuth'
									: 'API key'}
						</span>
					</div>
					<span
						data-ui="connection-state"
						data-tone={provider.authenticated ? 'ok' : 'muted'}
					>
						<i></i>{provider.authenticated
							? provider.source || 'Authenticated'
							: 'Not configured'}
					</span>
					{#if provider.supportsApiKey}
						<div data-ui="endpoint-field">
							<label for="api-key-{provider.id}" data-ui="sr-only"
								>API key for {provider.name}</label
							>
							<input
								id="api-key-{provider.id}"
								type="password"
								bind:value={drafts[provider.id]}
								placeholder={provider.authenticated &&
								provider.credentialType === 'api_key'
									? 'Replace API key'
									: `Paste ${provider.name} API key`}
								autocomplete="off"
								spellcheck="false"
							/>
							<Button
								variant="secondary"
								size="sm"
								disabled={store.providersLoading ||
									savingId === provider.id ||
									!(drafts[provider.id] ?? '').trim()}
								onclick={() => void saveKey(provider.id, provider.name)}
							>
								{savingId === provider.id ? 'Saving…' : 'Save'}
							</Button>
							{#if provider.authenticated && provider.credentialType === 'api_key'}
								<Button
									variant="secondary"
									size="sm"
									disabled={store.providersLoading ||
										removingId === provider.id}
									onclick={() => void removeKey(provider.id, provider.name)}
								>
									{removingId === provider.id ? 'Removing…' : 'Remove'}
								</Button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong>Refresh from Pi</strong>
				<span>
					Refresh credentials from Pi. Normal Gizmo mode imports
					~/.pi/agent/auth.json; Pi Web reads it directly. Existing live threads
					keep their current runtime.
				</span>
			</div>
			<Button
				variant="secondary"
				size="sm"
				disabled={store.providersLoading}
				onclick={() => void reimport()}
			>
				Refresh Pi auth
			</Button>
		</div>
	</div>
</SettingsPage>
