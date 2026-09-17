import type { ActiveSession, SessionRuntimePool } from './session-runtime-pool';

/** Reloads one resident Pi runtime, swapping in a fresh extension UI runtime. */
export async function reloadRuntime(active: ActiveSession) {
	if (!active.session.reload) {
		throw new Error('Runtime reload is unavailable for this session');
	}
	active.extensionUi.clear();
	await active.session.reload({
		beforeSessionStart: () => {
			active.extensionUi.clear();
			active.extensionUi.startNewRuntime();
		},
	});
}

/**
 * Reloads every resident Pi runtime so it picks up changed extension code.
 * A session mid-turn cannot be reloaded safely; it is marked and reloaded by
 * the pool once its turn settles.
 */
export async function reloadAllSessions(
	pool: SessionRuntimePool,
): Promise<{ reloaded: string[]; pending: string[] }> {
	pool.onPendingReload ??= async (sessionId) => {
		if (!pool.has(sessionId)) return;
		const active = pool.active(sessionId);
		if (active.session.isStreaming || active.session.isCompacting) {
			pool.deferReload(sessionId);
			return;
		}
		await reloadRuntime(active);
	};
	const reloaded: string[] = [];
	const pending: string[] = [];
	for (const sessionId of pool.sessionIds()) {
		const active = pool.active(sessionId);
		if (!active.session.reload) continue;
		if (active.session.isStreaming || active.session.isCompacting) {
			pool.deferReload(sessionId);
			pending.push(sessionId);
			continue;
		}
		try {
			await reloadRuntime(active);
			reloaded.push(sessionId);
		} catch (error) {
			console.error(`Runtime reload failed for ${sessionId}:`, error);
		}
	}
	return { reloaded, pending };
}
