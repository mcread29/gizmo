<script lang="ts">
	import type { ToolCallView } from '@unity-agent/protocol';
	import { commandName } from '../unity/unity-view';
	import UnityTestResults from '../unity/UnityTestResults.svelte';
	import DiffView from './DiffView.svelte';
	import { patchFileName } from '../changes/thread-changes';
	import { formatToolResult, recordValue, stringValue } from './format';
	import { highlightCode } from './highlight';
	import { toolParameters } from './tool-summary';
	import UnityScriptResult from './UnityScriptResult.svelte';

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
		tool.name === 'unity_script'
			? toolParameters(tool.input).filter(([name]) => name !== 'code')
			: toolParameters(tool.input),
	);
	// Structured results are JSON; the code blocks beside them are highlighted,
	// so these should be too. highlight.js escapes its own output.
	let highlighted = $derived(
		typeof tool.result === 'string'
			? undefined
			: highlightCode(resultText, 'json'),
	);
	let instances = $derived(readArray(tool.result, 'instances'));
	let commands = $derived(
		readArray(tool.result, 'commands')
			.map(commandName)
			.filter((name): name is string => name !== undefined),
	);

	function readArray(value: unknown, key: string): unknown[] {
		const candidate = recordValue(value, key);
		return Array.isArray(candidate) ? candidate : [];
	}
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
{:else if tool.name === 'unity_status'}
	<div data-ui="tool-metrics">
		<div>
			<span>State</span><strong
				>{stringValue(recordValue(tool.result, 'state')) ??
					tool.statusText}</strong
			>
		</div>
		<div><span>Editors</span><strong>{instances.length}</strong></div>
	</div>
	{#each instances as instance, index (index)}
		<div data-ui="editor-result">
			<strong
				>{stringValue(recordValue(instance, 'projectPath')) ??
					'Connected Editor'}</strong
			>
			<span
				>{stringValue(recordValue(instance, 'version')) ?? 'Unknown version'} · Port
				{stringValue(recordValue(instance, 'port')) ?? '—'}</span
			>
		</div>
	{/each}
{:else if tool.name === 'unity_list_commands'}
	{#if commands.length}
		<div data-ui="tool-command-list">
			{#each commands as command (command)}<code>{command}</code>{/each}
		</div>
	{:else}
		<p data-ui="tool-empty">No registered commands were returned.</p>
	{/if}
{:else if tool.name === 'unity_console'}
	<div data-ui="tool-metrics">
		<div><span>Entries</span><strong>{consoleEntries.length}</strong></div>
		<div>
			<span>Cursor</span><strong
				>{stringValue(recordValue(tool.result, 'cursor')) ?? '—'}</strong
			>
		</div>
	</div>
{:else if tool.name === 'unity_wait_for_compile' || tool.name === 'unity_wait_for_command'}
	<div data-ui="tool-metrics">
		<div>
			<span>State</span><strong
				>{stringValue(recordValue(tool.result, 'state')) ??
					tool.statusText}</strong
			>
		</div>
		<div>
			<span>Diagnostics</span><strong
				>{consoleEntries.length + errors.length}</strong
			>
		</div>
	</div>
{:else if tool.name === 'unity_test'}
	<UnityTestResults result={tool.result} {projectPath} />
{:else if tool.name === 'unity_script'}
	<UnityScriptResult input={tool.input} result={tool.result} />
{:else if diff}
	<DiffView {diff} file={diffFile} {projectPath} />
{:else if resultText}
	<pre data-ui="structured-result"><code class="hljs language-json"
			>{#if highlighted}{@html highlighted}{:else}{resultText}{/if}</code
		></pre>
{:else}
	<p data-ui="tool-empty">The tool completed without additional output.</p>
{/if}
