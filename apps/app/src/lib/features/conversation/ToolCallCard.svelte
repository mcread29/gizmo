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
	import { commandName } from '../unity/unity-view';
	import DiffView from './DiffView.svelte';
	import { formatToolResult, recordValue, stringValue } from './format';

	interface Props {
		tool: ToolCallView;
	}

	let { tool }: Props = $props();
	let open = $state(false);
	let copied = $state(false);
	let previousStatus: ToolCallView['status'] | undefined;
	let resultText = $derived(formatToolResult(tool.result));
	let diff = $derived(
		stringValue(recordValue(tool.result, 'patch')) ??
			stringValue(recordValue(tool.result, 'diff')),
	);
	let instances = $derived(readArray(tool.result, 'instances'));
	let commands = $derived(
		readArray(tool.result, 'commands')
			.map(commandName)
			.filter((name): name is string => name !== undefined),
	);
	let errors = $derived(readArray(tool.result, 'errors'));

	$effect(() => {
		const status = tool.status;
		if (status === 'running' || status === 'error') open = true;
		else if (previousStatus && previousStatus !== 'complete') open = false;
		previousStatus = status;
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

	function toolLabel(name: string) {
		switch (name) {
			case 'unity_status':
				return 'Unity Editor status';
			case 'unity_list_commands':
				return 'Unity commands';
			case 'unity_command':
				return 'Unity command';
			case 'read':
				return 'Read file';
			case 'edit':
				return 'Edit file';
			case 'write':
				return 'Write file';
			default:
				return name;
		}
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
	<summary data-ui="tool-header">
		{#if tool.name.startsWith('unity_')}
			<PlugZap size={15} />
		{:else if tool.name === 'read' || tool.name === 'edit' || tool.name === 'write'}
			<FileCode2 size={15} />
		{:else}
			<Terminal size={15} />
		{/if}
		<span
			><strong>{toolLabel(tool.name)}</strong><small>{tool.statusText}</small
			></span
		>
		{#if tool.status === 'running'}
			<CircleDashed data-ui="spinner" size={15} />
		{:else if tool.status === 'complete'}
			<CircleCheck size={15} />
		{:else}
			<CircleX size={15} />
		{/if}
	</summary>

	<div data-ui="tool-content">
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
			{#each instances as instance}
				<div data-ui="editor-result">
					<strong
						>{stringValue(recordValue(instance, 'projectPath')) ??
							'Connected Editor'}</strong
					>
					<span
						>{stringValue(recordValue(instance, 'version')) ??
							'Unknown version'} · Port {stringValue(
							recordValue(instance, 'port'),
						) ?? '—'}</span
					>
				</div>
			{/each}
		{:else if tool.name === 'unity_list_commands'}
			{#if commands.length}
				<div data-ui="tool-command-list">
					{#each commands as command}<code>{command}</code>{/each}
				</div>
			{:else}
				<p data-ui="tool-empty">No registered commands were returned.</p>
			{/if}
		{:else if diff}
			<DiffView {diff} />
		{:else if resultText}
			<pre data-ui="structured-result"><code>{resultText}</code></pre>
		{:else}
			<p data-ui="tool-empty">The tool completed without additional output.</p>
		{/if}

		{#if errors.length}
			<div data-ui="tool-errors">
				{#each errors as error}<p>
						{stringValue(recordValue(error, 'message')) ??
							formatToolResult(error)}
					</p>{/each}
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
