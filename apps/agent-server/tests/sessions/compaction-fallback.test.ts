import type { CompactionPolicy } from '@gizmo/protocol';
import { describe, expect, it, vi } from 'vitest';
import {
	compactOverdueRun,
	compactRequested,
	compactionOverdue,
} from '../../src/sessions/compaction-fallback';
import { FakePiSession } from './support/pi-agent-service-fixtures';

const policy: CompactionPolicy = {
	enabled: true,
	fillPercent: 25,
	retainPercent: 10,
};

function overdueSession() {
	const pi = new FakePiSession();
	return Object.assign(pi, { getContextUsage: () => ({ percent: 40 }) });
}

describe('requested compaction', () => {
	it('retries inside the turn when a whole-turn cut has nothing to fold', async () => {
		const pi = new FakePiSession();
		pi.compact.mockRejectedValueOnce(
			new Error('Nothing to compact (session too small)'),
		);

		await compactRequested(pi, policy);

		expect(pi.compact).toHaveBeenCalledTimes(2);
		expect(pi.configureCompaction.mock.calls).toEqual([
			[policy],
			[policy, { splitTurns: true }],
			[policy],
		]);
	});

	it('surfaces other failures without retrying', async () => {
		const pi = new FakePiSession();
		pi.compact.mockRejectedValueOnce(new Error('Compaction failed: 401'));

		await expect(compactRequested(pi, policy)).rejects.toThrow('401');
		expect(pi.compact).toHaveBeenCalledOnce();
	});
});

describe('overdue compaction', () => {
	it('is due once the context passes the threshold', () => {
		const pi = overdueSession();
		expect(compactionOverdue(pi, policy)).toBe(true);
		expect(compactionOverdue(pi, { ...policy, fillPercent: 50 })).toBe(false);
		expect(compactionOverdue(pi, { ...policy, enabled: false })).toBe(false);
	});

	it('compacts inside the turn and restores the whole-turn policy after', async () => {
		const pi = overdueSession();
		const onError = vi.fn();

		await compactOverdueRun(pi, policy, onError);

		expect(pi.compact).toHaveBeenCalledOnce();
		expect(pi.configureCompaction.mock.calls).toEqual([
			[policy, { splitTurns: true }],
			[policy],
		]);
		expect(onError).not.toHaveBeenCalled();
	});

	it('leaves a compaction already in flight alone', async () => {
		const pi = overdueSession();
		pi.isCompacting = true;

		await compactOverdueRun(pi, policy, vi.fn());

		expect(pi.compact).not.toHaveBeenCalled();
		expect(pi.configureCompaction).not.toHaveBeenCalled();
	});

	it('reports a failed compaction and logs the cause', async () => {
		const pi = overdueSession();
		pi.compact.mockRejectedValueOnce(new Error('summary model unavailable'));
		const onError = vi.fn();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});

		await compactOverdueRun(pi, policy, onError);

		expect(onError).toHaveBeenCalledWith(
			'Context is past the auto-compaction threshold but could not be compacted: summary model unavailable',
		);
		expect(log).toHaveBeenCalledOnce();
		expect(pi.configureCompaction).toHaveBeenLastCalledWith(policy);
		log.mockRestore();
	});
});
