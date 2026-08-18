<script lang="ts">
	import { CircleCheck, FolderOpen, Terminal } from '@lucide/svelte';
	import { Button, Tabs } from '../../components';
	import CompilerDiagnosticList from './CompilerDiagnosticList.svelte';
	import type { UnityView } from './unity-view';
	import { readEditorValue } from './unity-view';

	interface Props {
		view: UnityView;
		projectError?: string;
		projectOpening: boolean;
		onOpenProject: () => void;
	}

	let { view, projectError, projectOpening, onOpenProject }: Props = $props();
	let inspectorTab = $state('editor');
</script>

<aside
	data-ui="inspector"
	data-context-kind="unity"
	data-context-value={view.projectPath}
	aria-label="Unity Editor inspector"
>
	<div data-ui="inspector-header">
		<div>
			<span data-ui="eyebrow">Unity Editor</span>
			<h2>{view.projectName}</h2>
		</div>
		<span data-ui="status-pill" data-state={view.lifecycle.state}
			><span></span>{view.lifecycle.label}</span
		>
	</div>

	<Tabs
		items={[
			{ value: 'editor', label: 'Editor' },
			{ value: 'activity', label: 'Activity' },
		]}
		bind:value={inspectorTab}
	>
		{#snippet children(value)}
			{#if value === 'editor'}
				<div data-ui="inspector-stack">
					<section data-ui="inspector-card">
						<div data-ui="card-label">Runtime</div>
						<dl>
							<div>
								<dt>State</dt>
								<dd>
									<span
										data-ui="status-dot"
										data-status={view.status?.state === 'connected'
											? 'online'
											: 'disconnected'}
									></span>{view.state}
								</dd>
							</div>
							<div>
								<dt>Version</dt>
								<dd>{view.version ?? '—'}</dd>
							</div>
							<div>
								<dt>Pipeline</dt>
								<dd>
									{view.status?.state === 'connected' ? 'Connected' : '—'}
								</dd>
							</div>
							<div>
								<dt>Lifecycle</dt>
								<dd>{view.lifecycle.label}</dd>
							</div>
						</dl>
					</section>
					{#if view.lifecycle.errors.length}
						<section data-ui="inspector-card" data-state="error">
							<div data-ui="card-label">Compiler errors</div>
							<CompilerDiagnosticList
								errors={view.lifecycle.errors}
								projectPath={view.projectPath}
							/>
						</section>
					{/if}
					<section data-ui="inspector-card">
						<div data-ui="card-label">Connection</div>
						{#if view.editor}
							<dl>
								<div>
									<dt>Project</dt>
									<dd>{view.projectPath ?? '—'}</dd>
								</div>
								<div>
									<dt>Port</dt>
									<dd>{readEditorValue(view.editor, ['port']) ?? '—'}</dd>
								</div>
								<div>
									<dt>Process</dt>
									<dd>
										{readEditorValue(view.editor, ['pid', 'processId']) ?? '—'}
									</dd>
								</div>
							</dl>
						{:else}
							<p data-ui="inspector-message">
								{projectError ??
									view.status?.errors[0]?.message ??
									'The selected project Editor is not open.'}
							</p>
							{#if view.selectedProject}
								<Button
									variant="primary"
									size="sm"
									disabled={projectOpening}
									onclick={onOpenProject}
									><FolderOpen size={14} />{projectOpening
										? 'Opening Editor…'
										: 'Open Editor'}</Button
								>
							{/if}
						{/if}
					</section>
				</div>
			{:else if view.toolActivity.length === 0}
				<div data-ui="empty-state">
					<CircleCheck size={22} /><strong>All caught up</strong><span
						>Tool activity will appear here.</span
					>
				</div>
			{:else}
				<div data-ui="activity-list">
					{#each view.toolActivity as tool (tool.id)}
						<div data-ui="activity-item" data-state={tool.status}>
							<Terminal size={14} /><span
								><strong>{tool.name}</strong><small>{tool.statusText}</small
								></span
							>
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}
	</Tabs>
</aside>
