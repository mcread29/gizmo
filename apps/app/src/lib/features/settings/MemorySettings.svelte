<script lang="ts">
	import type {
		DigestOverride,
		JournalDigest,
		JournalFact,
		MemoryStatus,
	} from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Switch } from 'bits-ui';
	import { Button, SettingField } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import MemoryDigestList from './MemoryDigestList.svelte';
	import MemoryFactList from './MemoryFactList.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let status = $state<MemoryStatus | undefined>();
	let digests = $state<JournalDigest[]>([]);
	let facts = $state<JournalFact[]>([]);
	let query = $state('');
	let busy = $state(false);

	let models = $derived(store.availableModels);
	let coverage = $derived(
		status && status.segments > 0
			? Math.round((status.digested / status.segments) * 100)
			: 0,
	);
	let undigested = $derived(
		status ? Math.max(0, status.segments - status.digested) : 0,
	);
	/**
	 * The current choice is marked on the options rather than set on the
	 * select: the list comes from an `{#each}` that renders after the select
	 * itself, so a value assigned to the element finds no option to match and
	 * leaves the control showing nothing. "No model" carries a sentinel
	 * because an empty value reads as "unset" to the same machinery.
	 */
	const noModel = 'none';
	const inherit = 'inherit';
	let selectedModel = $derived(
		!status?.overridden
			? inherit
			: status.settings.model
				? `${status.settings.model.provider}/${status.settings.model.id}`
				: noModel,
	);
	let defaultLabel = $derived(
		status?.defaults.model
			? `${status.defaults.model.provider} · ${status.defaults.model.id}`
			: 'off',
	);

	async function refresh() {
		if (store.connection !== 'connected' || !store.selectedProjectPath) return;
		try {
			status = await store.memory.memoryStatus();
			digests = await store.memory.memoryDigests(query || undefined);
			facts = await store.memory.memoryFacts();
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Could not read memory',
				'danger',
			);
		}
	}

	$effect(() => {
		void refresh();
	});

	/**
	 * A backfill runs for minutes on the server and reports progress through
	 * status, so the page polls while one is in flight rather than holding a
	 * request open.
	 */
	$effect(() => {
		if (!status?.running) return;
		const timer = setInterval(() => void refresh(), 1500);
		return () => clearInterval(timer);
	});

	/**
	 * Three outcomes, not two: inheriting the default is distinct from
	 * choosing to digest nothing here, and only an override can say the
	 * latter.
	 */
	async function selectModel(value: string) {
		if (value === inherit) return save(undefined);
		const separator = value.indexOf('/');
		await save({
			...(status?.overridden && status.settings.auto !== status.defaults.auto
				? { auto: status.settings.auto }
				: {}),
			model:
				value === noModel || separator < 1
					? null
					: {
							provider: value.slice(0, separator),
							id: value.slice(separator + 1),
						},
		});
	}

	/** Undefined clears the override, so this workspace inherits again. */
	async function save(override: DigestOverride | undefined) {
		try {
			await store.memory.setMemoryOverride(override);
			await refresh();
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Could not save',
				'danger',
			);
		}
	}

	async function backfill(regenerate = false) {
		busy = true;
		try {
			status = await store.memory.startMemoryBackfill(regenerate);
		} catch (error) {
			toasts.show(
				error instanceof Error ? error.message : 'Could not start',
				'danger',
			);
		} finally {
			busy = false;
		}
	}

	async function stop() {
		try {
			status = await store.memory.stopMemoryBackfill();
		} catch {
			// Stopping a run that already finished is not worth a message.
		}
	}
</script>

<SettingsPage
	title="Memory"
	scope="Digests are derived from this workspace's journal and can be rebuilt"
>
	{#snippet actions()}
		{#if status}
			<span data-ui="settings-page-count">
				{status.digested} of {status.segments} segments
			</span>
		{/if}
	{/snippet}

	<div data-ui="settings-card">
		<SettingField
			label="Digest model"
			description="Summarizes each journal segment into what stays true afterwards, so search reads decisions instead of raw transcript."
			stacked
		>
			<select
				aria-label="Digest model"
				onchange={(event) => selectModel(event.currentTarget.value)}
			>
				<option value={inherit} selected={selectedModel === inherit}>
					Use the default ({defaultLabel})
				</option>
				<option value={noModel} selected={selectedModel === noModel}>
					Off for this workspace
				</option>
				{#each models as model (`${model.provider}/${model.id}`)}
					{@const ref = `${model.provider}/${model.id}`}
					<option value={ref} selected={selectedModel === ref}>
						{model.provider} · {model.name}
					</option>
				{/each}
			</select>
		</SettingField>

		<SettingField
			label="Digest new segments automatically"
			description="Each segment is digested as it is journaled. Failures are skipped and picked up by the next backfill."
		>
			<Switch.Root
				data-ui="switch"
				checked={status?.settings.auto ?? true}
				aria-label="Digest new segments automatically"
				onCheckedChange={(auto: boolean) =>
					save({
						...(status?.overridden && status.settings.model
							? { model: status.settings.model }
							: {}),
						auto,
					})}
			>
				<Switch.Thumb data-ui="switch-thumb" />
			</Switch.Root>
		</SettingField>
	</div>

	<div data-ui="settings-card">
		<SettingField label="Coverage" stacked>
			{#snippet detail()}
				{#if status?.running}
					{status.running.phase === 'facts'
						? 'Deriving facts from'
						: 'Digesting'}
					{status.running.done} of {status.running.total}
					{#if status.running.failed > 0}
						· {status.running.failed} failed
					{/if}
					{#if status.running.error}
						<span data-ui="memory-error">{status.running.error}</span>
					{/if}
				{:else if undigested > 0}
					{undigested} segment{undigested === 1 ? '' : 's'} not yet digested.
				{:else if status && status.segments > 0}
					Every segment has a digest.
				{:else}
					No journal segments yet.
				{/if}
			{/snippet}
			<progress value={coverage} max="100" aria-label="Digest coverage"
			></progress>
		</SettingField>

		<div data-ui="setting-actions">
			{#if status?.running}
				<Button variant="secondary" onclick={stop}>Stop</Button>
			{:else}
				<Button
					disabled={busy || !status?.settings.model || undigested === 0}
					onclick={() => backfill(false)}
				>
					Digest {undigested} segment{undigested === 1 ? '' : 's'}
				</Button>
				<Button
					variant="secondary"
					disabled={busy || !status?.settings.model || !status?.segments}
					onclick={() => backfill(true)}
				>
					Rebuild all
				</Button>
			{/if}
		</div>
	</div>

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<h3>What is currently true</h3>
			<span>
				Statements the project still stands behind, derived from the digests. A
				later session that contradicts one retires it, so this list shrinks as
				well as grows.
			</span>
		</div>

		<MemoryFactList {facts} />
	</div>

	<div data-ui="settings-card">
		<div data-ui="settings-section-header">
			<h3>Saved memories</h3>
			<span>What the agent recalls from this workspace, newest first.</span>
			<input
				type="search"
				placeholder="Filter decisions, summaries, errors"
				aria-label="Filter memories"
				bind:value={query}
				oninput={() => void refresh()}
			/>
		</div>

		<MemoryDigestList {digests} {query} />
	</div>
</SettingsPage>
