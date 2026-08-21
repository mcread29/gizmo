<script lang="ts">
	import type { ToolCallView } from '@gizmo/protocol';
	import { DiffView } from '@gizmo/ui';
	import { patchFileName } from '@gizmo/git/web';
	import {
		formatToolResult,
		recordValue,
		stringValue,
	} from '@gizmo/design/format';
	import { highlightCode } from '@gizmo/design/highlight';
	import { toolParameters } from './tool-summary';
	import { webExtensions as toolPresentationPlugins } from '../../extensions/registry.svelte';

	interface Props {
		tool: ToolCallView;
		projectPath?: string;
		consoleEntries: unknown[];
		errors: unknown[];
	}

	let { tool, projectPath, consoleEntries, errors }: Props = $props();

	let resultText = $derived(formatToolResult(tool.result));
	let diff = $derived(
		stringValue(recordValue(tool.result, 'patch')) ??
			stringValue(recordValue(tool.result, 'diff')),
	);
	let diffFile = $derived(
		stringValue(recordValue(tool.result, 'file')) ??
			(diff ? patchFileName(diff) : undefined),
	);
	let parameters = $derived(
		toolPresentationPlugins().reduce(
			(params, plugin) => plugin.parametersFor?.(tool.name, params) ?? params,
			toolParameters(tool.input),
		),
	);
	// Structured results are JSON; the code blocks beside them are highlighted,
	// so these should be too. highlight.js escapes its own output.
	let highlighted = $derived(
		typeof tool.result === 'string'
			? undefined
			: highlightCode(resultText, 'json'),
	);
	let resultComponent = $derived(
		toolPresentationPlugins()
			.map((plugin) => plugin.resultFor?.(tool.name))
			.find((component) => component !== undefined),
	);
</script>

{#if parameters.length}
	<dl data-ui="tool-parameters">
		{#each parameters as [name, value] (name)}
			<div>
				<dt>{name}</dt>
				<dd>{value}</dd>
			</div>
		{/each}
	</dl>
{/if}

{#if tool.status === 'running' && !resultText}
	<p data-ui="tool-empty">Waiting for the tool to finish…</p>
{:else if resultComponent}
	{@const ResultComponent = resultComponent}
	<ResultComponent {tool} {projectPath} {consoleEntries} {errors} />
{:else if diff}
	<DiffView {diff} file={diffFile} {projectPath} />
{:else if resultText}
	<pre data-ui="structured-result"><code class="hljs language-json"
			>{#if highlighted}{@html highlighted}{:else}{resultText}{/if}</code
		></pre>
{:else}
	<p data-ui="tool-empty">The tool completed without additional output.</p>
{/if}
