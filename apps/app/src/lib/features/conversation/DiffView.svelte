<script lang="ts">
	interface Props {
		diff: string;
	}

	let { diff }: Props = $props();
	let lines = $derived(diff.split('\n'));

	function lineKind(line: string) {
		if (line.startsWith('+++') || line.startsWith('---')) return 'header';
		if (line.startsWith('+')) return 'added';
		if (line.startsWith('-')) return 'removed';
		if (line.startsWith('@@')) return 'range';
		return 'context';
	}
</script>

<pre data-ui="diff">{#each lines as line}<span data-kind={lineKind(line)}
			>{line || ' '}</span
		>{/each}</pre>
