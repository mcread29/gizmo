<script lang="ts">
	import { ChevronDown, ChevronUp, Search, X } from '@lucide/svelte';
	import { Button } from '../../components';

	interface Props {
		query: string;
		matchCount: number;
		index: number;
		onStep: (direction: 1 | -1) => void;
		onClose: () => void;
		focus?: () => void;
	}

	let {
		query = $bindable(),
		matchCount,
		index,
		onStep,
		onClose,
		focus = $bindable(),
	}: Props = $props();

	let element = $state<HTMLInputElement>();
	focus = () => element?.select();
</script>

<div data-ui="transcript-search">
	<Search size={14} />
	<label for="transcript-search" data-ui="sr-only">Search this thread</label>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		id="transcript-search"
		bind:this={element}
		bind:value={query}
		type="search"
		placeholder="Find in thread"
		autocomplete="off"
		autofocus
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				onStep(event.shiftKey ? -1 : 1);
			}
			if (event.key === 'Escape') onClose();
		}}
	/>
	<span data-ui="search-count">
		{matchCount ? `${index + 1} of ${matchCount}` : query ? 'No matches' : ''}
	</span>
	<Button
		variant="ghost"
		size="icon"
		aria-label="Previous match"
		disabled={matchCount === 0}
		onclick={() => onStep(-1)}><ChevronUp size={15} /></Button
	>
	<Button
		variant="ghost"
		size="icon"
		aria-label="Next match"
		disabled={matchCount === 0}
		onclick={() => onStep(1)}><ChevronDown size={15} /></Button
	>
	<Button
		variant="ghost"
		size="icon"
		aria-label="Close search"
		onclick={onClose}><X size={15} /></Button
	>
</div>
