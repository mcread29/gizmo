<script lang="ts">
	import type { JournalFact } from '@gizmo/protocol';

	let { facts }: { facts: JournalFact[] } = $props();

	/**
	 * Grouped by subject rather than listed flat. Facts arrive newest first,
	 * which scatters the two or three statements about the same thing across
	 * the page; a reader asking "what do we know about X" wants them together.
	 * Group order follows the newest fact in each group, so a subject the
	 * project touched today leads.
	 */
	let groups = $derived.by(() => {
		const bySubject = new Map<string, JournalFact[]>();
		for (const fact of facts) {
			const existing = bySubject.get(fact.subject);
			if (existing) existing.push(fact);
			else bySubject.set(fact.subject, [fact]);
		}
		return [...bySubject].map(([subject, entries]) => ({ subject, entries }));
	});
</script>

{#each groups as group (group.subject)}
	<article data-ui="memory-fact">
		<header>
			<strong>{group.subject}</strong>
			<code>{group.entries[0]?.segment}</code>
		</header>
		<ul>
			{#each group.entries as fact (fact.id)}
				<li>
					{fact.statement}
					{#if fact.supersedes.length > 0}
						<em title="Replaced an earlier fact">revised</em>
					{/if}
				</li>
			{/each}
		</ul>
	</article>
{:else}
	<p data-ui="settings-empty">
		Nothing stands yet. Facts are derived from digests, so digest this
		workspace first.
	</p>
{/each}
