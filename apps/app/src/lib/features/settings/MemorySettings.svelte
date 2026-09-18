<script lang="ts">
	import type { JournalDigest, MemoryStatus } from '@gizmo/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Switch } from 'bits-ui';
	import { Button } from '../../components';
	import { toasts } from '../../toasts.svelte';
	import SettingsPage from './SettingsPage.svelte';

	let { store }: { store: AgentStore } = $props();

	let status = $state<MemoryStatus | undefined>();
	let digests = $state<JournalDigest[]>([]);
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
	let selectedModel = $derived(
		status?.settings.model
			? `${status.settings.model.provider}/${status.settings.model.id}`
			: noModel,
	);

	async function refresh() {
		if (store.connection !== 'connected' || !store.selectedProjectPath) return;
		try {
			status = await store.memory.memoryStatus();
			digests = await store.memory.memoryDigests(query || undefined);
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

	async function selectModel(value: string) {
		const separator = value.indexOf('/');
		const settings = { ...(status?.settings ?? { auto: true }) };
		await save(
			value !== noModel && separator > 0
				? {
						...settings,
						model: {
							provider: value.slice(0, separator),
							id: value.slice(separator + 1),
						},
					}
				: { auto: settings.auto },
		);
	}

	async function save(settings: MemoryStatus['settings']) {
		try {
			await store.memory.setMemorySettings(settings);
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
		<div data-ui="setting-field" data-layout="stacked">
			<div>
				<strong>Digest model</strong>
				<span>
					Summarizes each journal segment into what stays true afterwards, so
					search reads decisions instead of raw transcript.
				</span>
			</div>
			<select
				aria-label="Digest model"
				onchange={(event) => selectModel(event.currentTarget.value)}
			>
				<option value={noModel} selected={selectedModel === noModel}>
					No model — digesting is off
				</option>
				{#each models as model (`${model.provider}/${model.id}`)}
					{@const ref = `${model.provider}/${model.id}`}
					<option value={ref} selected={selectedModel === ref}>
						{model.provider} · {model.name}
					</option>
				{/each}
			</select>
		</div>

		<div data-ui="setting-field">
			<div>
				<strong>Digest new segments automatically</strong>
				<span>
					Each segment is digested as it is journaled. Failures are skipped and
					picked up by the next backfill.
				</span>
			</div>
			<Switch.Root
				data-ui="switch"
				checked={status?.settings.auto ?? true}
				aria-label="Digest new segments automatically"
				onCheckedChange={(auto: boolean) =>
					save({ ...(status?.settings ?? { auto: true }), auto })}
			>
				<Switch.Thumb data-ui="switch-thumb" />
			</Switch.Root>
		</div>
	</div>

	<div data-ui="settings-card">
		<div data-ui="setting-field" data-layout="stacked">
			<div>
				<strong>Coverage</strong>
				<span>
					{#if status?.running}
						Digesting {status.running.done} of {status.running.total}
						{#if status.running.failed > 0}
							· {status.running.failed} failed
						{/if}
					{:else if undigested > 0}
						{undigested} segment{undigested === 1 ? '' : 's'} not yet digested.
					{:else if status && status.segments > 0}
						Every segment has a digest.
					{:else}
						No journal segments yet.
					{/if}
				</span>
			</div>
			<progress value={coverage} max="100" aria-label="Digest coverage"
			></progress>
		</div>

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
		<div data-ui="setting-field" data-layout="stacked">
			<div>
				<strong>Saved memories</strong>
				<span>What the agent recalls from this workspace, newest first.</span>
			</div>
			<input
				type="search"
				placeholder="Filter decisions, summaries, errors"
				aria-label="Filter memories"
				bind:value={query}
				oninput={() => void refresh()}
			/>
		</div>

		{#each digests as digest (digest.segment)}
			<article data-ui="memory-digest">
				<header>
					<code>{digest.segment}</code>
					<em data-outcome={digest.outcome}>{digest.outcome}</em>
				</header>
				<p>{digest.summary}</p>
				{#if digest.decisions.length > 0}
					<strong>Decisions</strong>
					<ul>
						{#each digest.decisions as decision (decision)}
							<li>{decision}</li>
						{/each}
					</ul>
				{/if}
				{#if digest.errors.length > 0}
					<strong>Errors</strong>
					<ul>
						{#each digest.errors as issue (issue)}
							<li>{issue}</li>
						{/each}
					</ul>
				{/if}
				{#if digest.files.length > 0}
					<div data-ui="memory-digest-files">
						{#each digest.files as file (file)}
							<code>{file}</code>
						{/each}
					</div>
				{/if}
			</article>
		{:else}
			<p data-ui="settings-empty">
				{query
					? 'No memories match that filter.'
					: 'No memories yet. Choose a model and digest this workspace.'}
			</p>
		{/each}
	</div>
</SettingsPage>
