<script lang="ts">
	import { onDestroy } from 'svelte';
	import { renderMarkdown } from './markdown';

	interface Props {
		content: string;
		streaming?: boolean;
	}

	let { content, streaming = false }: Props = $props();
	let displayedContent = $state('');
	let pendingContent = '';
	let timer: ReturnType<typeof setTimeout> | undefined;
	let html = $derived(renderMarkdown(displayedContent));

	$effect(() => {
		pendingContent = content;
		if (!streaming) {
			clearTimeout(timer);
			timer = undefined;
			displayedContent = content;
		} else if (timer === undefined) {
			timer = setTimeout(() => {
				timer = undefined;
				displayedContent = pendingContent;
			}, 50);
		}
	});

	onDestroy(() => clearTimeout(timer));

	function handleCodeCopies(node: HTMLElement) {
		const copyCode = async (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest<HTMLButtonElement>('[data-copy-code]');
			if (!button) return;
			const code = button.parentElement?.nextElementSibling?.textContent;
			if (!code || !navigator.clipboard) return;
			await navigator.clipboard.writeText(code);
			button.textContent = 'Copied';
			window.setTimeout(() => (button.textContent = 'Copy'), 1_500);
		};
		node.addEventListener('click', copyCode);
		return { destroy: () => node.removeEventListener('click', copyCode) };
	}
</script>

<!-- Model output is sanitized in renderMarkdown before it reaches this boundary. -->
<div data-ui="markdown" use:handleCodeCopies>{@html html}</div>
