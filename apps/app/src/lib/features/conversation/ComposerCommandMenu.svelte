<script lang="ts">
	import type { ComposerCommand } from '@gizmo/protocol';
	import { FileText, Sparkles, Terminal } from '@lucide/svelte';

	interface Props {
		commands: ComposerCommand[];
		selected: number;
		onSelect: (command: ComposerCommand) => void;
	}

	let { commands, selected, onSelect }: Props = $props();

	const labels = {
		extension: 'Command',
		prompt: 'Prompt',
		skill: 'Skill',
	} as const;
</script>

<div
	id="composer-command-menu"
	data-ui="composer-command-menu"
	role="listbox"
	aria-label="Composer commands"
>
	{#each commands as command, index (command.source + ':' + command.name)}
		<button
			type="button"
			role="option"
			id={`composer-command-${index}`}
			aria-selected={index === selected}
			data-selected={index === selected || undefined}
			onpointerdown={(event) => event.preventDefault()}
			onclick={() => onSelect(command)}
		>
			<span data-ui="composer-command-icon">
				{#if command.source === 'skill'}
					<Sparkles size={15} />
				{:else if command.source === 'prompt'}
					<FileText size={15} />
				{:else}
					<Terminal size={15} />
				{/if}
			</span>
			<span data-ui="composer-command-copy">
				<strong>/{command.name}</strong>
				{#if command.description}<small>{command.description}</small>{/if}
			</span>
			<span data-ui="composer-command-kind">{labels[command.source]}</span>
		</button>
	{/each}
</div>
