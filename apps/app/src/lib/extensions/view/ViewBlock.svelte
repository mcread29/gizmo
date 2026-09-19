<script lang="ts">
	import type { Block } from '@gizmo/extension-api';
	import { highlightCode } from '@gizmo/design/highlight';
	import { DiffView } from '@gizmo/ui';
	import MarkdownContent from '../../features/conversation/MarkdownContent.svelte';
	import ListBlock from './ListBlock.svelte';
	import LogBlock from './LogBlock.svelte';
	import TableBlock from './TableBlock.svelte';
	import TreeNodes from './TreeNodes.svelte';
	import ViewBlock from './ViewBlock.svelte';

	let {
		block,
		projectPath,
		selectionOf,
		onSelect,
	}: {
		block: Block;
		projectPath?: string;
		/** The item picked in a selectable block, if any. */
		selectionOf: (blockId: string) => string | undefined;
		onSelect: (blockId: string, itemId: string) => void;
	} = $props();

	let highlighted = $derived(
		block.type === 'code' && block.language
			? highlightCode(block.code, block.language)
			: undefined,
	);
</script>

{#if block.type === 'heading'}
	{#if block.level === 1}
		<h2 data-ui="view-heading">{block.text}</h2>
	{:else if block.level === 3}
		<h4 data-ui="view-heading">{block.text}</h4>
	{:else}
		<h3 data-ui="view-heading">{block.text}</h3>
	{/if}
{:else if block.type === 'text'}
	<p data-ui="view-text" data-tone={block.tone}>{block.text}</p>
{:else if block.type === 'markdown'}
	<div data-ui="view-markdown">
		<MarkdownContent content={block.markdown} />
	</div>
{:else if block.type === 'keyValue'}
	<dl data-ui="view-key-value">
		{#each block.entries as entry, index (index)}
			<div data-tone={entry.tone}>
				<dt>{entry.label}</dt>
				<dd>{entry.value}</dd>
			</div>
		{/each}
	</dl>
{:else if block.type === 'metric'}
	<div data-ui="view-metric" data-tone={block.tone}>
		<span data-ui="view-metric-label">{block.label}</span>
		<strong data-ui="view-metric-value">{block.value}</strong>
		{#if block.description}<small>{block.description}</small>{/if}
	</div>
{:else if block.type === 'list'}
	<ListBlock
		{block}
		selectedId={selectionOf(block.id)}
		onSelect={(itemId) => onSelect(block.id, itemId)}
	/>
{:else if block.type === 'table'}
	<TableBlock
		{block}
		selectedId={selectionOf(block.id)}
		onSelect={(itemId) => onSelect(block.id, itemId)}
	/>
{:else if block.type === 'tree'}
	{#if block.nodes.length === 0}
		<p data-ui="view-empty">{block.empty ?? 'Nothing to show.'}</p>
	{:else}
		<div data-ui="view-tree" data-block={block.id}>
			<TreeNodes
				nodes={block.nodes}
				selectedId={selectionOf(block.id)}
				onSelect={(itemId) => onSelect(block.id, itemId)}
			/>
		</div>
	{/if}
{:else if block.type === 'progress'}
	<div data-ui="view-progress" data-tone={block.tone}>
		{#if block.label}<span>{block.label}</span>{/if}
		<progress value={block.value} max={block.max}></progress>
	</div>
{:else if block.type === 'log'}
	<LogBlock {block} />
{:else if block.type === 'code'}
	<figure data-ui="view-code">
		{#if block.label}<figcaption>{block.label}</figcaption>{/if}
		<!-- highlight.js escapes its own output; the plain branch is text. -->
		<pre><code class="hljs"
				>{#if highlighted}{@html highlighted}{:else}{block.code}{/if}</code
			></pre>
	</figure>
{:else if block.type === 'diff'}
	<DiffView diff={block.diff} file={block.file} {projectPath} />
{:else if block.type === 'section'}
	<details data-ui="view-section" open={!block.collapsed}>
		<summary>{block.title}</summary>
		<div data-ui="view-blocks">
			{#each block.blocks as child, index (index)}
				<ViewBlock block={child} {projectPath} {selectionOf} {onSelect} />
			{/each}
		</div>
	</details>
{:else if block.type === 'divider'}
	<hr data-ui="view-divider" />
{:else if block.type === 'link'}
	<!-- Only http/https survive the schema, and `noopener` keeps the opened
	     page away from this window. -->
	<a
		data-ui="view-link"
		href={block.url}
		target="_blank"
		rel="noopener noreferrer">{block.text}</a
	>
{/if}
