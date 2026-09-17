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

export async function compactOverdueRun(
	session: PiSessionLike,
	policy: CompactionPolicy,
	onError: (message: string) => void,
): Promise<void> {
	if (!session.compact || !session.configureCompaction) return;
	session.configureCompaction(policy, { splitTurns: true });
	try {
		await session.compact();
	} catch (error) {
		onError(
			`Context is past the auto-compaction threshold but could not be compacted: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	} finally {
		session.configureCompaction(policy);
	}
}
