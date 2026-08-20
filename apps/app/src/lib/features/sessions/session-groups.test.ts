import { describe, expect, it } from 'vitest';
import {
	groupSessions,
	groupSessionsByProject,
	matchesQuery,
} from './session-groups';

const now = new Date('2026-08-17T12:00:00Z').getTime();
const day = 86_400_000;

function session(id: string, lastActiveAt: number, title = id) {
	return {
		id,
		title,
		createdAt: lastActiveAt,
		lastActiveAt,
		messageCount: 0,
	};
}

describe('groupSessions', () => {
	it('buckets by recency and drops empty buckets', () => {
		const groups = groupSessions(
			[
				session('a', now - 60_000),
				session('b', now - day),
				session('c', now - 30 * day),
			],
			now,
		);

		expect(groups.map((group) => group.label)).toEqual([
			'Today',
			'Yesterday',
			'Earlier',
		]);
		expect(groups[0]?.sessions.map(({ id }) => id)).toEqual(['a']);
	});
});

describe('matchesQuery', () => {
	const workspace = () => 'RenderingPlayground';

	it('matches on thread title and workspace name, ignoring case', () => {
		const thread = session('a', now, 'Fix the shader');

		expect(matchesQuery(thread, '', workspace)).toBe(true);
		expect(matchesQuery(thread, 'SHADER', workspace)).toBe(true);
		expect(matchesQuery(thread, 'rendering', workspace)).toBe(true);
		expect(matchesQuery(thread, 'physics', workspace)).toBe(false);
	});
});

describe('groupSessionsByProject', () => {
	it('sorts projects alphabetically and preserves thread recency', () => {
		const alpha = { ...session('new', now), workspacePath: '/projects/alpha' };
		const older = {
			...session('old', now - day),
			workspacePath: '/projects/alpha',
		};
		const beta = { ...session('beta', now), workspacePath: '/projects/beta' };
		const names = (path: string | undefined) =>
			path?.split('/').at(-1) ?? 'No project';

		const groups = groupSessionsByProject([beta, alpha, older], names);
		expect(groups.map(({ label }) => label)).toEqual(['alpha', 'beta']);
		expect(groups[0]?.sessions.map(({ id }) => id)).toEqual(['new', 'old']);
	});
});
