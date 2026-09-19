import type {
	DigestOverride,
	DigestSettings,
	JournalDigest,
	JournalFact,
	MemoryStatus,
} from '@gizmo/protocol';

/**
 * Stand-in memory layer for the fake client. Holds enough shape for the
 * Memory page to be driven without an agent server: a partly-digested journal,
 * so both the coverage bar and the backfill control have something to show.
 */
export class FakeMemoryCapability {
	#defaults: DigestSettings = {
		auto: true,
		model: { provider: 'opencode-go', id: 'minimax-m3' },
	};
	/** Absent until this workspace overrides the default, as on a real server. */
	#override: DigestOverride | undefined;

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

	/**
	 * Standing facts only, as the server sends them. The first two describe one
	 * subject without contradicting each other; the third records a change,
	 * which is why no "minimax-m3" fact appears here despite the digest above
	 * still mentioning it.
	 */
	readonly #facts: JournalFact[] = [
		{
			id: '0488#1',
			segment: '0488',
			at: '2026-09-18T20:10:02.100Z',
			subject: 'journal storage',
			statement:
				'The journal lives in .gizmo/memory/journal and is append-only; .agent-journal is retired.',
			supersedes: [],
		},
		{
			id: '0491#1',
			segment: '0491',
			at: '2026-09-18T21:54:28.954Z',
			subject: 'journal storage',
			statement:
				'Segment ids carry a hash suffix so two machines cannot collide, and index.jsonl union-merges.',
			supersedes: [],
		},
		{
			id: '0491#2',
			segment: '0491',
			at: '2026-09-18T21:54:28.954Z',
			subject: 'digest model',
			statement: 'Digests are written by opencode-go/glm-5.3.',
			supersedes: ['0402#1'],
		},
	];

	async status(): Promise<MemoryStatus> {
		return {
			segments: 491,
			digested: this.#digests.length,
			facts: this.#facts.length,
			factSegments: 2,
			settings: this.#effective(),
			defaults: this.#defaults,
			overridden: Boolean(this.#override),
		};
	}

	/** The override merged over the default, the same way the server merges it. */
	#effective(): DigestSettings {
		const override = this.#override;
		if (!override) return this.#defaults;
		const model = 'model' in override ? override.model : this.#defaults.model;
		return {
			auto: override.auto ?? this.#defaults.auto,
			...(model ? { model } : {}),
		};
	}

	async setOverride(override?: DigestOverride): Promise<DigestSettings> {
		this.#override = override;
		return this.#effective();
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

	/** The standing facts, newest segment first. */
	async facts(): Promise<JournalFact[]> {
		return [...this.#facts].sort((left, right) =>
			right.id.localeCompare(left.id),
		);
	}

	async setDefaults(settings: DigestSettings): Promise<DigestSettings> {
		this.#defaults = settings;
		return this.#effective();
	}
}
