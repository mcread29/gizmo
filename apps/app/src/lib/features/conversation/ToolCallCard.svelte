<script lang="ts">
	import type { ToolCallView } from '@unity-agent/protocol';
	import {
		Check,
		CircleCheck,
		CircleDashed,
		CircleX,
		Copy,
		FileCode2,
		PlugZap,
		Terminal,
	} from '@lucide/svelte';
	import { Button } from '../../components';
	import CompilerDiagnosticList from '../unity/CompilerDiagnosticList.svelte';
	import ToolResult from './ToolResult.svelte';
	import { formatToolResult, recordValue } from './format';
	import { toolIcon, toolLabel } from './tool-labels';
	import { toolSummary } from './tool-summary';

	interface Props {
		tool: ToolCallView;
		projectPath?: string;
	}

	let { tool, projectPath }: Props = $props();
	let open = $state(false);
	let copied = $state(false);
	/** Once the user has expressed a preference, status changes stop overriding it. */
	let pinned = $state(false);

	let resultText = $derived(formatToolResult(tool.result));
	// Progress text is the useful subtitle while a tool runs; once it has
	// finished, "Completed" says nothing the status icon has not already said.
	let summary = $derived(toolSummary(tool.input));
	let subtitle = $derived(
		tool.status === 'running' ? tool.statusText : (summary ?? tool.statusText),
	);
	let errors = $derived(readArray(tool.result, 'errors'));
	let consoleEntries = $derived(
		tool.name === 'unity_console'
			? readArray(tool.result, 'entries')
			: readArray(tool.result, 'consoleEntries'),
	);

	$effect(() => {
		const status = tool.status;
		if (pinned) return;
		open = status === 'running' || status === 'error';
	});

	async function copyResult() {
		if (!resultText || !navigator.clipboard) return;
		await navigator.clipboard.writeText(resultText);
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}

	function readArray(value: unknown, key: string): unknown[] {
		const candidate = recordValue(value, key);
		return Array.isArray(candidate) ? candidate : [];
	}
</script>

<details
	data-ui="tool-call"
	data-tool={tool.name}
	data-state={tool.status}
	data-context-kind="tool"
	data-context-id={tool.id}
	bind:open
>
	<summary data-ui="tool-header" onclick={() => (pinned = true)}>
		{#if toolIcon(tool.name) === 'unity'}
			<PlugZap size={15} />
		{:else if toolIcon(tool.name) === 'file'}
			<FileCode2 size={15} />
		{:else}
			<Terminal size={15} />
		{/if}
		<span>
			<strong>{toolLabel(tool.name)}</strong>
			<small title={summary}>{subtitle}</small>
		</span>
		{#if tool.status === 'running'}
			<CircleDashed data-ui="spinner" size={15} />
		{:else if tool.status === 'complete'}
			<CircleCheck size={15} />
		{:else}
			<CircleX size={15} />
		{/if}
	</summary>

	<div data-ui="tool-content">
		<ToolResult {tool} {projectPath} {consoleEntries} {errors} />

		{#if errors.length}
			<div data-ui="tool-errors">
				<CompilerDiagnosticList {errors} {projectPath} />
			</div>
		{/if}

		{#if consoleEntries.length}
			<div data-ui="tool-diagnostics">
				<CompilerDiagnosticList errors={consoleEntries} {projectPath} />
			</div>
		{/if}

		{#if resultText}
			<div data-ui="tool-actions">
				<Button variant="ghost" size="sm" onclick={copyResult}>
					{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy output{/if}
				</Button>
			</div>
		{/if}
	</div>
</details>
