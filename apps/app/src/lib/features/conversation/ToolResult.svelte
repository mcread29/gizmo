<script lang="ts">
	import type { ToolCallView } from '@gizmo/protocol';
	import { DiffView } from '@gizmo/ui';
	import { formatToolResult } from '@gizmo/design/format';
	import { highlightCode } from '@gizmo/design/highlight';
	import { toolParameters } from './tool-summary';
	import { toolDiff } from './tool-diff';
	import { extensionUi } from '../../extensions/extension-ui.svelte';

	interface Props {
		tool: ToolCallView;
		projectPath?: string;
	}

	let { tool, projectPath }: Props = $props();

	let resultText = $derived(formatToolResult(tool.result));
	let diff = $derived(toolDiff(tool));
	// An extension that names the parameters worth showing gets exactly those,
	// in the order it named them; every other tool shows all of them.
	let parameters = $derived.by(() => {
		const all = toolParameters(tool.input);
		const wanted = extensionUi.parametersFor(tool.name);
		if (!wanted) return all;
		return wanted.flatMap((name) => all.filter(([key]) => key === name));
	});
	// Structured results are JSON; the code blocks beside them are highlighted,
	// so these should be too. highlight.js escapes its own output.
	let highlighted = $derived(
		typeof tool.result === 'string'
			? undefined
			: highlightCode(resultText, 'json'),
	);
</script>

{#if parameters.length && tool.name !== 'display'}
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
{:else if diff}
	<DiffView diff={diff.diff} file={diff.file} {projectPath} />
{:else if resultText}
	<pre data-ui="structured-result"><code class="hljs language-json"
			>{#if highlighted}{@html highlighted}{:else}{resultText}{/if}</code
		></pre>
{:else}
	<p data-ui="tool-empty">The tool completed without additional output.</p>
{/if}
