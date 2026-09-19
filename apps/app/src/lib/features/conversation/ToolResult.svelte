<script lang="ts">
	import type { ToolCallView } from '@gizmo/protocol';
	import { DiffView } from '@gizmo/ui';
	import {
		formatToolResult,
		recordValue,
		stringValue,
	} from '@gizmo/design/format';
	import { highlightCode } from '@gizmo/design/highlight';
	import { toolParameters } from './tool-summary';
	import { extensionUi } from '../../extensions/extension-ui.svelte';

	interface Props {
		tool: ToolCallView;
		projectPath?: string;
	}

	let { tool, projectPath }: Props = $props();

	function patchFileName(patch: string) {
		for (const line of patch.split('\n')) {
			if (!line.startsWith('+++ ')) continue;
			const value = line.slice(4).trim().split('\t')[0];
			if (!value || value === '/dev/null') continue;
			return value.replace(/^[ab]\//, '');
		}
	}

	let resultText = $derived(formatToolResult(tool.result));
	let diff = $derived(
		stringValue(recordValue(tool.result, 'patch')) ??
			stringValue(recordValue(tool.result, 'diff')),
	);
	let diffFile = $derived(
		stringValue(recordValue(tool.result, 'file')) ??
			(diff ? patchFileName(diff) : undefined),
	);
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
	<DiffView {diff} file={diffFile} {projectPath} />
{:else if resultText}
	<pre data-ui="structured-result"><code class="hljs language-json"
			>{#if highlighted}{@html highlighted}{:else}{resultText}{/if}</code
		></pre>
{:else}
	<p data-ui="tool-empty">The tool completed without additional output.</p>
{/if}
