import type { CompactionPolicy } from '@gizmo/protocol';
import type { PiSessionLike } from './pi-agent-types';

/**
 * Pi's threshold compaction keeps whole turns, and it gives up silently when
 * the turn it would have to keep is the only one since the last summary: a
 * single long run of tool calls can push the context past the user's limit
 * with nothing older to fold away. The thread then sits above the threshold
 * turn after turn, and "auto-compact" looks broken.
 *
 * Once the run has settled, this compacts anyway, allowing the cut to land
 * inside that turn, so the setting means what it says.
 */
export function compactionOverdue(
	session: PiSessionLike,
	policy: CompactionPolicy | undefined,
): boolean {
	if (!policy?.enabled) return false;
	const usage = session.getContextUsage?.();
	if (!usage || usage.percent === null) return false;
	return usage.percent >= policy.fillPercent;
}

/** Pi's refusal when a whole-turn cut leaves nothing before the kept tail. */
function nothingToCompact(error: unknown): boolean {
	return error instanceof Error && /Nothing to compact/.test(error.message);
}

/**
 * A requested compaction prefers whole-turn cuts, but when the only turn
 * since the last summary is the entire remaining context, that cut has
 * nothing to fold away and Pi refuses with "session too small". The request
 * then retries allowing the cut to land inside that turn.
 */
export async function compactRequested(
	session: PiSessionLike,
	policy: CompactionPolicy,
): Promise<void> {
	if (!session.compact || !session.configureCompaction) {
		throw new Error('Compaction is unavailable for this session');
	}
	session.configureCompaction(policy);
	try {
		await session.compact();
	} catch (error) {
		if (!nothingToCompact(error)) throw error;
		session.configureCompaction(policy, { splitTurns: true });
		try {
			await session.compact();
		} finally {
			session.configureCompaction(policy);
		}
	}
}

export async function compactOverdueRun(
	session: PiSessionLike,
	policy: CompactionPolicy,
	onError: (message: string) => void,
): Promise<void> {
	if (!session.compact || !session.configureCompaction) return;
	// Two compactions on one Pi session tear each other down mid-flight; the
	// one already running will bring the context back under the threshold.
	if (session.isCompacting) return;
	session.configureCompaction(policy, { splitTurns: true });
	try {
		await session.compact();
	} catch (error) {
		// The client only gets the message; keep the stack where it can be found.
		console.error(`Overdue compaction failed for ${session.sessionId}:`, error);
		onError(
			`Context is past the auto-compaction threshold but could not be compacted: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	} finally {
		session.configureCompaction(policy);
	}
}
