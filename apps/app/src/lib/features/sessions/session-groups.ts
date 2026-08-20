import type { AgentSessionSummary } from '@unity-agent/protocol';

export interface SessionGroup {
	label: string;
	sessions: AgentSessionSummary[];
}

/** Threads still named by the server placeholder read better as a fresh start. */
export function threadTitle(title: string): string {
	return title === 'New session' ? 'New thread' : title;
}

export function matchesQuery(
	session: AgentSessionSummary,
	query: string,
	workspaceName: (projectPath: string | undefined) => string,
): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return (
		threadTitle(session.title).toLowerCase().includes(needle) ||
		workspaceName(session.workspacePath ?? session.projectPath)
			.toLowerCase()
			.includes(needle)
	);
}

/**
 * Buckets threads by recency so a long list stays scannable. Order within a
 * bucket is left as given — the store already keeps it most-recent-first.
 */
export function groupSessions(
	sessions: AgentSessionSummary[],
	now = Date.now(),
): SessionGroup[] {
	const startOfToday = new Date(now).setHours(0, 0, 0, 0);
	const startOfYesterday = startOfToday - 86_400_000;
	const startOfWeek = startOfToday - 6 * 86_400_000;

	const groups: SessionGroup[] = [
		{ label: 'Today', sessions: [] },
		{ label: 'Yesterday', sessions: [] },
		{ label: 'Previous 7 days', sessions: [] },
		{ label: 'Earlier', sessions: [] },
	];
	for (const session of sessions) {
		const at = session.lastActiveAt;
		const bucket =
			at >= startOfToday
				? 0
				: at >= startOfYesterday
					? 1
					: at >= startOfWeek
						? 2
						: 3;
		groups[bucket]!.sessions.push(session);
	}
	return groups.filter((group) => group.sessions.length > 0);
}

export function formatSessionTime(timestamp: number, now = Date.now()): string {
	const elapsedMinutes = Math.floor((now - timestamp) / 60_000);
	if (elapsedMinutes < 1) return 'Now';
	if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
	return new Intl.DateTimeFormat([], {
		month: 'short',
		day: 'numeric',
	}).format(timestamp);
}
