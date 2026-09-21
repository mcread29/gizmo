<script lang="ts">
	import { Download, RefreshCw } from '@lucide/svelte';
	import type { AgentStore } from '../../agent-client';
	import { Button, ResourceNote, SettingField } from '../../components';

	let { store }: { store: AgentStore } = $props();

	let update = $derived(store.appUpdate);
	let installing = $derived(
		update?.phase === 'installing' || update?.phase === 'restarting',
	);
	let busy = $derived(store.appUpdateBusy || installing);

	/*
	 * Refresh on every connect, not just on mount: an update ends with the
	 * socket dropping while the server restarts, and the page is still open
	 * when it comes back. Reading the status again is what turns the
	 * "restarting" notice into the version that is now running.
	 */
	$effect(() => {
		if (store.connection === 'connected') void store.updates.check();
	});

	let versionLabel = $derived(
		!update
			? 'Loading…'
			: update.install === 'source'
				? `source checkout at ${update.version}`
				: update.version,
	);
	let latestLabel = $derived(
		!update || update.checkedAt === undefined
			? undefined
			: update.checkError
				? `Could not check for updates: ${update.checkError}`
				: update.updateAvailable
					? `${update.latest ?? 'A newer version'} is available.`
					: 'Up to date.',
	);
</script>

<SettingField label="Version" description={latestLabel}>
	<span data-ui="resource-detail">{versionLabel}</span>
</SettingField>

<SettingField
	label="Update"
	description={update?.install === 'source'
		? 'Pulls the branch, installs dependencies, builds, and restarts.'
		: 'Installs the release beside this one and restarts onto it. The old release stays for rollback.'}
>
	{#if update?.updateAvailable && !installing}
		<Button
			variant="primary"
			size="sm"
			disabled={busy || store.connection !== 'connected'}
			onclick={() => void store.updates.start()}
		>
			<Download size={13} /> Update to {update.latest}
		</Button>
	{:else}
		<Button
			variant="secondary"
			size="sm"
			disabled={busy || store.connection !== 'connected'}
			onclick={() => void store.updates.check(true)}
		>
			<RefreshCw size={13} /> Check for updates
		</Button>
	{/if}
</SettingField>

{#if store.appUpdateError}
	<ResourceNote tone="error">{store.appUpdateError}</ResourceNote>
{:else if update?.phase === 'failed'}
	<ResourceNote tone="error"
		>Update to {update.target} failed. {update.message ?? ''}</ResourceNote
	>
{:else if update?.phase === 'installing'}
	<ResourceNote live
		>Installing {update.target}… {update.message ?? ''}</ResourceNote
	>
{:else if update?.phase === 'restarting' || (installing && store.connection !== 'connected')}
	<ResourceNote live
		>Restarting Gizmo on {update?.target}. This page reconnects on its own; give
		it up to two minutes.</ResourceNote
	>
{/if}
