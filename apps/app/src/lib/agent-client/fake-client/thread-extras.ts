import type { FakeClientState, FakeSession } from './state';
import { appendMessageToTree } from './tree';

/**
 * What happens around a fake run rather than in it: the steering queue, the
 * usage figure the meter reads, and the compaction a long enough thread
 * records. Kept apart from the stream so `?fake` can show every thread row
 * without a real model.
 */
export class FakeThreadExtras {
	/** Text steered into a run in flight, delivered after its tools finish. */
	readonly #queued = new Map<string, string[]>();
	readonly #compacted = new Set<string>();

	constructor(private readonly state: FakeClientState) {}

	queue(sessionId: string, text: string) {
		const queued = [...(this.#queued.get(sessionId) ?? []), text];
		this.#queued.set(sessionId, queued);
		this.#emitQueue(sessionId, queued);
	}

	/** Drains the queue, telling the thread nothing is waiting any more. */
	takeQueued(sessionId: string): string[] {
		const queued = this.#queued.get(sessionId) ?? [];
		if (queued.length) {
			this.#queued.delete(sessionId);
			this.#emitQueue(sessionId, []);
		}
		return queued;
	}

	/** Usage grows with the thread so the meter has something to show. */
	emitUsage(sessionId: string, session: FakeSession) {
		const contextUsed = 9_000 * session.summary.messageCount;
		this.state.emit({
			type: 'session.usage',
			sessionId,
			usage: {
				input: contextUsed - 1_200,
				output: 1_200,
				cacheRead: 0,
				cacheWrite: 0,
				contextUsed,
				contextWindow: 200_000,
				cost: 0.002 * session.summary.messageCount,
			},
		});
	}

	/** A long enough thread compacts once, so the row recording it appears. */
	compactIfLong(sessionId: string, session: FakeSession) {
		if (session.summary.messageCount < 5 || this.#compacted.has(sessionId))
			return;
		this.#compacted.add(sessionId);
		void this.compact(sessionId);
	}

	async compact(sessionId: string) {
		const session = this.state.getSession(sessionId);
		const reason = 'threshold' as const;
		this.state.emit({
			type: 'session.compaction',
			sessionId,
			active: true,
			reason,
		});
		const signal = new AbortController().signal;
		await this.state.wait(signal);
		await this.state.wait(signal);
		const summary =
			'Inspected the Editor, listed commands, and edited the player script.';
		appendMessageToTree(session, {
			id: this.state.nextId('compaction'),
			role: 'event',
			content: '',
			createdAt: Date.now(),
			complete: true,
			tools: [],
			event: { kind: 'compaction', reason, tokensBefore: 128_400, summary },
		});
		this.state.emit({
			type: 'session.compaction',
			sessionId,
			active: false,
			reason,
			result: { tokensBefore: 128_400, summary },
		});
	}

	#emitQueue(sessionId: string, steering: string[]) {
		this.state.emit({
			type: 'session.queue',
			sessionId,
			steering,
			followUp: [],
		});
	}
}
