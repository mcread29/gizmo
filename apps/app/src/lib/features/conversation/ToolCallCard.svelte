<script lang="ts">
	import { readDisplayResult, type ToolCallView } from '@gizmo/protocol';
	import DisplayResult from './DisplayResult.svelte';
	import {
		Check,
		CircleCheck,
		CircleDashed,
		CircleX,
		Copy,
		FileCode2,
		Terminal,
	} from '@lucide/svelte';
	import { extensionIcon } from '../../extensions/icons';
	import { Button } from '../../components';
	import { copyToClipboard } from '../../clipboard';
	import { toasts } from '../../toasts.svelte';
	import ToolResult from './ToolResult.svelte';
	import {
		formatToolResult,
		recordValue,
		stringValue,
	} from '@gizmo/design/format';
	import { toolIcon, toolLabel } from './tool-labels';
	import { toolSummary } from './tool-summary';

	interface Props {
		tool: ToolCallView;
		projectPath?: string;
		/** Changes when the thread asks every tool call to collapse. */
		collapseToken?: number;
		/** Marks this call as a search hit. */
		matched?: boolean;
		/** This is the tool currently running in the active turn. */
		active?: boolean;
	}

	let {
		tool,
		projectPath,
		collapseToken,
		matched,
		active = false,
	}: Props = $props();
	let open = $state(false);
	let copied = $state(false);
	/** Once the user has expressed a preference, status changes stop overriding it. */
	let pinned = $state(false);

	let resultText = $derived(formatToolResult(tool.result));
	let icon = $derived(toolIcon(tool.name));
	// Any tool may return a `gizmoDisplay` envelope, not only the built-in
	// display tool: an extension tool describes its card as data, either as a
	// json-render spec or as a view the host renders with the same blocks an
	// inspector tab uses.
	let display = $derived.by(() => {
		if (tool.status === 'error' || !hasDisplay(tool.result)) return undefined;
		return readDisplayResult(tool.result);
	});
	let summary = $derived(
		tool.name === 'display'
			? display && 'title' in display
				? display.title
				: undefined
			: toolSummary(tool.input),
	);
	let errors = $derived(readArray(tool.result, 'errors'));
	/** The failure, carried on the card's one line so a crashed run does not
	 * look calmer than it is; the full output stays one click away. */
	let errorExcerpt = $derived.by(() => {
		if (tool.status !== 'error') return undefined;
		const first = errors[0];
		const message =
			typeof first === 'string'
				? first
				: (stringValue(recordValue(first, 'message')) ??
					stringValue(recordValue(first, 'error')) ??
					stringValue(recordValue(tool.result, 'error')));
		return message?.replace(/\s+/g, ' ').trim() || undefined;
	});
	// Every card is one line: the tool name in full, then whatever identifies
	// this call, truncated. Progress text is the useful subtitle while a tool
	// runs; a failure's message beats "Failed"; once finished, the status icon
	// already says "Completed".
	let subtitle = $derived(
		tool.status === 'running'
			? tool.statusText
			: (errorExcerpt ?? summary ?? tool.statusText),
	);

	$effect(() => {
		active;
		if (pinned) return;
		open = active;
	});

	// An explicit collapse overrides whatever the user had pinned open. The
	// first run only records the token, so mounting does not pin every card.
	let seenToken: number | undefined;
	$effect(() => {
		const token = collapseToken;
		if (token === undefined || seenToken === undefined || token === seenToken) {
			seenToken = token;
			return;
		}
		seenToken = token;
		open = false;
		pinned = true;
	});

	async function copyResult() {
		if (!(await copyToClipboard(resultText))) {
			toasts.show('Could not copy: clipboard is unavailable here', 'danger');
			return;
		}
		copied = true;
		window.setTimeout(() => (copied = false), 1_500);
	}

	function hasDisplay(result: unknown): boolean {
		return (
			result !== null &&
			typeof result === 'object' &&
			'gizmoDisplay' in (result as Record<string, unknown>)
		);
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
	data-matched={matched || undefined}
	bind:open
>
	<summary
		data-ui="tool-header"
		onclick={(event) => {
			event.preventDefault();
			pinned = true;
			open = !open;
		}}
	>
		<!-- `file`/`shell` are the app's own; anything else is a lucide name
		     an extension asked for. -->
		{#if icon === 'file'}
			<FileCode2 size={15} />
		{:else if icon === 'shell'}
			<Terminal size={15} />
		{:else}
			{@const Icon = extensionIcon(icon)}
			<Icon size={15} />
		{/if}
		<strong>{toolLabel(tool.name)}</strong>
		<small
			data-tone={errorExcerpt && !open ? 'danger' : undefined}
			title={subtitle}>{subtitle}</small
		>
		{#if tool.status === 'running'}
			<CircleDashed data-ui="spinner" size={15} />
		{:else if tool.status === 'complete'}
			<CircleCheck size={15} />
		{:else}
			<CircleX size={15} />
		{/if}
	</summary>

	{#if open && !display}
		<div data-ui="tool-content">
			<ToolResult {tool} {projectPath} />

			{#if resultText}
				<div data-ui="tool-actions">
					<Button variant="ghost" size="sm" onclick={copyResult}>
						{#if copied}<Check size={13} /> Copied{:else}<Copy size={13} /> Copy output{/if}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</details>

{#if display}
	<DisplayResult {display} {projectPath} />
{/if}
