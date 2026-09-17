import { describe, expect, it, vi } from 'vitest';
import { reloadAllSessions } from '../../src/sessions/session-reload';
import type {
	ActiveSession,
	SessionRuntimePool,
} from '../../src/sessions/session-runtime-pool';

function fakePool(sessions: Record<string, { streaming: boolean }>) {
	const deferred: string[] = [];
	const reloads: string[] = [];
	const active = new Map<string, ActiveSession>();
	for (const [id, { streaming }] of Object.entries(sessions)) {
		active.set(id, {
			session: {
				isStreaming: streaming,
				reload: async () => {
					reloads.push(id);
				},
			},
			extensionUi: { clear: vi.fn(), startNewRuntime: vi.fn() },
		} as unknown as ActiveSession);
	}
	const pool = {
		sessionIds: () => [...active.keys()],
		has: (id: string) => active.has(id),
		active: (id: string) => active.get(id)!,
		deferReload: (id: string) => deferred.push(id),
		onPendingReload: undefined as SessionRuntimePool['onPendingReload'],
	};
	return {
		pool: pool as unknown as SessionRuntimePool,
		deferred,
		reloads,
		active,
	};
}

describe('reloadAllSessions', () => {
	it('defers a compacting runtime until its compaction settles', async () => {
		const { pool, deferred, reloads, active } = fakePool({
			busy: { streaming: false },
		});
		const session = active.get('busy')!.session as { isCompacting: boolean };
		session.isCompacting = true;
		await reloadAllSessions(pool);
		expect(deferred).toEqual(['busy']);
		expect(reloads).toEqual([]);
		session.isCompacting = false;
		await pool.onPendingReload!('busy');
		expect(reloads).toEqual(['busy']);
	});
	it('reloads idle runtimes now and defers the streaming ones', async () => {
		const { pool, deferred, reloads } = fakePool({
			idle: { streaming: false },
			busy: { streaming: true },
		});
		await expect(reloadAllSessions(pool)).resolves.toEqual({
			reloaded: ['idle'],
			pending: ['busy'],
		});
		expect(reloads).toEqual(['idle']);
		expect(deferred).toEqual(['busy']);
	});

	it('installs a settle handler that reloads a deferred session once idle', async () => {
		const { pool, reloads, active } = fakePool({ busy: { streaming: true } });
		await reloadAllSessions(pool);
		expect(pool.onPendingReload).toBeDefined();
		(active.get('busy')!.session as { isStreaming: boolean }).isStreaming =
			false;
		await pool.onPendingReload!('busy');
		expect(reloads).toEqual(['busy']);
	});
});
