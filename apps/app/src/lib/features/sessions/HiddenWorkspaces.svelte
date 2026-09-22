<script lang="ts">
	import { ChevronRight, Eye } from '@lucide/svelte';
	import type { StoredProject } from '@gizmo/protocol';
	import { Button, Tooltip } from '../../components';

	interface Props {
		/** Workspaces the user hid; they keep every thread and setting. */
		projects: StoredProject[];
		openWorkspacePath?: string;
		onOpenWorkspace: (projectPath: string) => void;
		onShow: (projectPath: string) => void;
	}

	let { projects, openWorkspacePath, onOpenWorkspace, onShow }: Props =
		$props();

	// Collapsed by default: hidden workspaces are out of the way by
	// definition, so the row is a reminder they exist, not a second list.
	let open = $state(false);
	let label = $derived(
		`${projects.length} hidden workspace${projects.length === 1 ? '' : 's'}`,
	);
</script>

<div data-ui="hidden-workspaces" data-open={open || undefined}>
	<button
		data-ui="hidden-workspaces-toggle"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<ChevronRight size={13} />
		<span>{label}</span>
	</button>

	{#if open}
		<div data-ui="hidden-workspace-list">
			{#each projects as project (project.path)}
				<div data-ui="hidden-workspace-row">
					<button
						data-ui="hidden-workspace-entry"
						data-context-kind="workspace"
						data-context-value={project.path}
						aria-label={`Open ${project.title}`}
						aria-current={project.path === openWorkspacePath
							? 'page'
							: undefined}
						title={project.path}
						onclick={() => onOpenWorkspace(project.path)}
					>
						{project.title}
					</button>
					<Tooltip text={`Show ${project.title}`}>
						{#snippet children(props)}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								aria-label={`Show ${project.title}`}
								onclick={() => onShow(project.path)}><Eye size={14} /></Button
							>
						{/snippet}
					</Tooltip>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	[data-ui='hidden-workspaces'] {
		margin-top: var(--space-2);
	}

	[data-ui='hidden-workspaces-toggle'] {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: var(--color-text-faint);
		font: inherit;
		font-size: var(--text-xs);
		text-align: left;
		cursor: pointer;
	}

	[data-ui='hidden-workspaces-toggle']:hover {
		color: var(--color-text-muted);
	}

	[data-ui='hidden-workspaces-toggle'] :global(svg) {
		flex: none;
		transition: transform 120ms ease;
	}

	[data-ui='hidden-workspaces'][data-open]
		[data-ui='hidden-workspaces-toggle']
		:global(svg) {
		transform: rotate(90deg);
	}

	[data-ui='hidden-workspace-row'] {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding-left: var(--space-4);
	}

	[data-ui='hidden-workspace-entry'] {
		flex: 1;
		min-width: 0;
		padding: var(--space-1) 0;
		border: 0;
		overflow: hidden;
		background: none;
		color: var(--color-text-faint);
		font: inherit;
		font-size: var(--text-xs);
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}

	[data-ui='hidden-workspace-entry']:hover {
		color: var(--color-text);
	}
</style>
