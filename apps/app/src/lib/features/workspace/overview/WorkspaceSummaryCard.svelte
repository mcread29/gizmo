<script lang="ts">
	import type { AgentStore } from '../../../agent-client';
	import type { WorkspaceTab } from '../../../router.svelte';
	import type { WorkspaceConfiguration } from '../workspace-config.svelte';

	interface Props {
		store: AgentStore;
		workspacePath: string;
		configuration: WorkspaceConfiguration;
		onSelectTab: (tab: WorkspaceTab) => void;
	}

	let { store, workspacePath, configuration, onSelectTab }: Props = $props();

	let agentsLines = $state<number>();
	let agentsExists = $state<boolean>();

	// The other three numbers are already in the store; this one is a file, so
	// Overview reads it once rather than sending you to the tab to find out
	// whether the workspace has instructions at all.
	$effect(() => {
		let current = true;
		agentsLines = undefined;
		agentsExists = undefined;
		void store
			.readInstructions('project-agents', workspacePath)
			.then((file) => {
				if (!current) return;
				agentsExists = file.exists;
				agentsLines = file.content ? file.content.split(/\r?\n/).length : 0;
			})
			.catch(() => {});
		return () => {
			current = false;
		};
	});

	let skills = $derived(
		store.resources?.workspacePath === workspacePath
			? (store.resources?.skills ?? []).filter((skill) => skill.installed)
			: [],
	);
	// The tab lists leftover profile-system domains alongside the Pi extensions,
	// so the count has to cover both or Overview contradicts the page it links
	// to. A workspace can only turn a globally enabled row off, never force one
	// on, which is why the global state gates the override rather than the
	// other way round.
	let piExtensions = $derived(store.resources?.extensions ?? []);
	let extensions = $derived([
		...piExtensions.map(({ id, enabled }) => ({ id, globallyOn: enabled })),
		...configuration.domains
			.filter(({ id }) => !piExtensions.some((row) => row.id === id))
			.map(({ id }) => ({ id, globallyOn: true })),
	]);
	let extensionsOn = $derived(
		extensions.filter(({ id, globallyOn }) => {
			const override =
				configuration.config?.piExtensions?.find((row) => row.id === id)
					?.enabled ??
				configuration.config?.gizmoExtensions?.find((row) => row.id === id)
					?.enabled;
			return globallyOn && (override ?? true);
		}).length,
	);

	let stats = $derived([
		{
			tab: 'skills' as const,
			label: 'Skills on',
			value: `${skills.filter((skill) => skill.enabled).length} of ${skills.length}`,
		},
		{
			tab: 'extensions' as const,
			label: 'Extensions on',
			value: `${extensionsOn} of ${extensions.length}`,
		},
		{
			tab: 'instructions' as const,
			label: 'Built-in tools',
			value: store.toolPolicy?.project ? 'Overridden' : 'Inherit global',
		},
		{
			tab: 'instructions' as const,
			label: 'AGENTS.md',
			value:
				agentsExists === undefined
					? '—'
					: agentsExists
						? `${agentsLines} lines`
						: 'Not created',
		},
	]);
</script>

<section data-ui="workspace-summary" aria-label="Configuration">
	{#each stats as stat (stat.label)}
		<button data-ui="workspace-stat" onclick={() => onSelectTab(stat.tab)}>
			<strong>{stat.value}</strong>
			<span>{stat.label}</span>
		</button>
	{/each}
</section>
