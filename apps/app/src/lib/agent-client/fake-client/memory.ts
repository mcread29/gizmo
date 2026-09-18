import type {
	DigestSettings,
	JournalDigest,
	MemoryStatus,
} from '@gizmo/protocol';

/**
 * Stand-in memory layer for the fake client. Holds enough shape for the
 * Memory page to be driven without an agent server: a partly-digested journal,
 * so both the coverage bar and the backfill control have something to show.
 */
export class FakeMemoryCapability {
	#settings: DigestSettings = {
		auto: true,
		model: { provider: 'opencode-go', id: 'minimax-m3' },
	};

	readonly #digests: JournalDigest[] = [
		{
			segment: '0491-af033d08',
			at: '2026-09-18T21:54:28.954Z',
			model: 'opencode-go/minimax-m3',
			summary:
				'Made journal segment ids collision-safe across machines and set the index to union-merge, then verified the 450 legacy segments still resolve.',
			decisions: [
				'Do not migrate legacy segments; bare-ordinal and suffixed ids cannot collide because ids are only ever string-compared.',
			],
			files: [
				'apps/agent-server/src/memory/journal-store.ts',
				'.gitattributes',
			],
			errors: [],
			outcome: 'shipped',
		},
		{
			segment: '0488-1c02b7d5',
			at: '2026-09-18T20:10:02.100Z',
			model: 'opencode-go/minimax-m3',
			summary:
				'Recovered six orphaned segments from the superseded .agent-journal directory and retired it.',
			decisions: [
				'Retire .agent-journal only after a backfill proves every segment exists in the new journal.',
			],
			files: ['.gitignore'],
			errors: [
				'A bash probe undercounted coverage because lines starting with "-" were parsed as grep options; rewritten in Python.',
			],
			outcome: 'shipped',
		},
	];

	async status(): Promise<MemoryStatus> {
		return {
			segments: 491,
			digested: this.#digests.length,
			settings: this.#settings,
		};
	}

	async digests(query?: string, limit = 100): Promise<JournalDigest[]> {
		const terms = (query ?? '')
			.toLowerCase()
			.split(/\s+/)
			.filter((term) => term.length > 1);
		const matches = this.#digests.filter((digest) => {
			if (terms.length === 0) return true;
			const haystack = [digest.summary, ...digest.decisions, ...digest.errors]
				.join('\n')
				.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		});
		return matches.slice(0, limit);
	}

	async setSettings(settings: DigestSettings): Promise<DigestSettings> {
		this.#settings = settings;
		return settings;
	}
}
