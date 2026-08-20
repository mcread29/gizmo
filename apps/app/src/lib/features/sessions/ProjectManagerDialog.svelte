<script lang="ts">
	import { FolderOpen } from '@lucide/svelte';
	import type {
		ProjectDomains,
		WorkspaceIntegration,
	} from '@unity-agent/protocol';
	import type { AgentStore } from '../../agent-client';
	import { Button, Dialog } from '../../components';

	interface Props {
		open?: boolean;
		store: AgentStore;
	}

	type Setup = {
		available: ProjectDomains['domains'];
		integrations: WorkspaceIntegration[];
	};

	let { open = $bindable(false), store }: Props = $props();
	let project = $derived(
		store.projects.find(({ path }) => path === store.selectedProjectPath),
	);
	let setup = $state<Setup>();
	let saving = $state(false);
	let error = $state<string>();

	$effect(() => {
		if (!open || !project) return;
		const selected = project;
		let current = true;
		setup = undefined;
		error = undefined;
		void store
			.detectProject(selected.path)
			.then(({ domains }) => {
				if (current) {
					setup = {
						available: domains,
						integrations: selected.integrations.map((integration) => ({
							...integration,
						})),
					};
				}
			})
			.catch((cause) => {
				if (current) error = message(cause);
			});
		return () => {
			current = false;
		};
	});

	function enabled(id: string) {
		return (
			setup?.integrations.some((integration) => integration.id === id) ?? false
		);
	}

	function toggle(id: string, checked: boolean) {
		if (!setup) return;
		if (checked) {
			const root =
				setup.available.find((candidate) => candidate.id === id)?.root ?? '.';
			setup.integrations = [...setup.integrations, { id, root }];
		} else {
			setup.integrations = setup.integrations.filter(
				(integration) => integration.id !== id,
			);
		}
	}

	function changeRoot(id: string, root: string) {
		const integration = setup?.integrations.find(
			(candidate) => candidate.id === id,
		);
		if (integration) integration.root = root;
	}

	async function save() {
		if (!project || !setup) return;
		saving = true;
		error = undefined;
		try {
			await store.addProject(project.path, setup.integrations);
			open = false;
		} catch (cause) {
			error = message(cause);
		} finally {
			saving = false;
		}
	}

	function message(value: unknown) {
		return value instanceof Error ? value.message : String(value);
	}
</script>

<Dialog
	bind:open
	title={project ? `${project.title} setup` : 'Workspace setup'}
	description="Configure integrations for the current workspace"
>
	{#if project}
		<div data-ui="workspace-setup">
			<div data-ui="workspace-setup-path">
				<FolderOpen size={17} /><span>{project.path}</span>
			</div>
			{#if error}<p data-ui="onboarding-error">{error}</p>{/if}
			{#if setup}
				<div data-ui="integration-list" data-layout="workspace-setup">
					{#each setup.available as integration (integration.id)}
						<label data-ui="integration-row">
							<input
								type="checkbox"
								checked={enabled(integration.id)}
								onchange={(event) =>
									toggle(integration.id, event.currentTarget.checked)}
							/>
							<span>
								<strong>{integration.name}</strong>
								<small
									>{integration.detected
										? 'Detected in this workspace'
										: 'Not detected'}</small
								>
							</span>
							{#if enabled(integration.id)}
								<input
									aria-label={`${integration.name} root`}
									value={setup.integrations.find(
										({ id }) => id === integration.id,
									)?.root ?? '.'}
									oninput={(event) =>
										changeRoot(integration.id, event.currentTarget.value)}
								/>
							{/if}
						</label>
					{/each}
				</div>
				<div data-ui="dialog-actions">
					<Button size="sm" disabled={saving} onclick={() => void save()}>
						{saving ? 'Saving…' : 'Save setup'}
					</Button>
				</div>
			{:else if !error}
				<div data-ui="skeleton" data-shape="workspace-card"></div>
			{/if}
		</div>
	{/if}
</Dialog>
