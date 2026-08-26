<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
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

	async function reimport() {
		if (await store.reimportPiAuth()) {
			toasts.show('Refreshed Pi authentication for new threads', 'success');
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
			<p data-ui="resource-empty">No providers found.</p>
		{:else}
			{#each store.providers as provider (provider.id)}
				<div data-ui="setting-field">
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
