<script lang="ts">
	import type { AgentStore } from '../../agent-client';
	import { Button } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import type { WorkspaceLayout } from '../shell/workspace.svelte';
	import SettingsPage from './SettingsPage.svelte';

	interface Props {
		layout: WorkspaceLayout;
		store: AgentStore;
	}

	let { layout, store }: Props = $props();

	let draft = $state('');
	let applying = $state(false);

	// Re-seeded when the saved address changes so the field never drifts.
	$effect(() => {
		draft = layout.agentUrl;
	});

	const states: Record<string, { label: string; tone: string }> = {
		connected: { label: 'Connected', tone: 'ok' },
		connecting: { label: 'Connecting…', tone: 'pending' },
		reconnecting: { label: 'Reconnecting…', tone: 'pending' },
		disconnected: { label: 'Disconnected', tone: 'danger' },
	};

	let status = $derived(
		states[store.connection] ?? { label: store.connection, tone: 'pending' },
	);
	let resolved = $derived(layout.agentUrl || 'Built-in local sidecar');

	async function apply() {
		applying = true;
		layout.agentUrl = draft.trim();
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
</script>

<SettingsPage title="Connection" scope="Stored on this device">
	<div data-ui="settings-card">
		<div data-ui="setting-field">
			<div>
				<strong>Agent server</strong>
				<span>{resolved}</span>
			</div>
			<span data-ui="connection-state" data-tone={status.tone}
				><i></i>{status.label}</span
			>
		</div>
		<div data-ui="setting-field" data-layout="stacked">
			<div>
				<strong>Address</strong>
				<span
					>Leave empty to use the local sidecar. Changing this reconnects.</span
				>
			</div>
			<div data-ui="endpoint-field">
				<label for="agent-url" data-ui="sr-only">Agent server address</label>
				<input
					id="agent-url"
					bind:value={draft}
					placeholder="ws://127.0.0.1:8787/agent"
					autocomplete="off"
					spellcheck="false"
				/>
				<Button
					variant="secondary"
					size="sm"
					disabled={applying || draft.trim() === layout.agentUrl}
					onclick={() => void apply()}
					>{applying ? 'Connecting…' : 'Apply'}</Button
				>
			</div>
		</div>
	</div>
</SettingsPage>
