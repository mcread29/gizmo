<script lang="ts">
	import type { ComponentRenderer } from '@json-render/svelte';
	import type { ComponentProps } from 'svelte';
	import { displayProps, type DisplayProps } from './display-catalog';

	let { element, children }: ComponentProps<ComponentRenderer> = $props();
</script>

{#snippet Heading(props: DisplayProps<'Heading'>)}
	<svelte:element this={`h${props.level ?? 2}`}>{props.text}</svelte:element>
{/snippet}
{#snippet Text(props: DisplayProps<'Text'>)}<p>{props.text}</p>{/snippet}
{#snippet Card(props: DisplayProps<'Card'>)}
	<section class="card" aria-label={props.title}>
		{#if props.title}<h3>{props.title}</h3>{/if}
		{@render children?.()}
	</section>
{/snippet}
{#snippet Stack()}
	<div class="stack">{@render children?.()}</div>
{/snippet}
{#snippet List(props: DisplayProps<'List'>)}
	<ul>
		{#each props.items as item}<li>{item}</li>{/each}
	</ul>
{/snippet}
{#snippet Table(props: DisplayProps<'Table'>)}
	<!-- Keyboard users must be able to scroll wide tables. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="table-scroll" role="region" aria-label="Data table" tabindex="0">
		<table>
			<thead
				><tr
					>{#each props.columns as column}<th scope="col">{column}</th
						>{/each}</tr
				></thead
			>
			<tbody
				>{#each props.rows as row}<tr
						>{#each row as cell}<td>{cell}</td>{/each}</tr
					>{/each}</tbody
			>
		</table>
	</div>
{/snippet}
{#snippet Metric(props: DisplayProps<'Metric'>)}
	<dl class="metric">
		<dt>{props.label}</dt>
		<dd>{props.value}</dd>
		{#if props.description}<dd class="description">{props.description}</dd>{/if}
	</dl>
{/snippet}
{#snippet Divider()}<hr />{/snippet}

{#if element.type === 'Heading'}{@render Heading(
		displayProps.Heading.parse(element.props),
	)}
{:else if element.type === 'Text'}{@render Text(
		displayProps.Text.parse(element.props),
	)}
{:else if element.type === 'Card'}{@render Card(
		displayProps.Card.parse(element.props),
	)}
{:else if element.type === 'Stack'}{@render Stack()}
{:else if element.type === 'List'}{@render List(
		displayProps.List.parse(element.props),
	)}
{:else if element.type === 'Table'}{@render Table(
		displayProps.Table.parse(element.props),
	)}
{:else if element.type === 'Metric'}{@render Metric(
		displayProps.Metric.parse(element.props),
	)}
{:else if element.type === 'Divider'}{@render Divider()}{/if}

<style>
	:global([data-ui='display-result']) {
		min-width: 0;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
	:global([data-ui='display-result']) :is(h1, h2, h3) {
		margin: 0;
		font-weight: 600;
	}
	:global([data-ui='display-result']) h1 {
		font-size: var(--text-xl);
	}
	:global([data-ui='display-result']) h2 {
		font-size: var(--text-lg);
	}
	:global([data-ui='display-result']) h3 {
		font-size: var(--text-base);
	}
	p,
	ul,
	dl {
		margin: 0;
	}
	p {
		white-space: pre-wrap;
	}
	.stack,
	.card {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.card {
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	ul {
		padding-inline-start: var(--space-5);
	}
	.table-scroll {
		overflow-x: auto;
	}
	.table-scroll:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: var(--space-2);
		text-align: start;
		border-bottom: 1px solid var(--color-border);
	}
	th {
		font-weight: 600;
	}
	.metric dd {
		margin: 0;
		font-size: var(--text-lg);
		font-variant-numeric: tabular-nums;
	}
	.metric dt,
	.metric .description {
		color: var(--color-text-muted);
		font-size: var(--text-sm);
	}
	hr {
		width: 100%;
		margin: var(--space-2) 0;
		border: 0;
		border-top: 1px solid var(--color-border);
	}
</style>
