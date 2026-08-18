import type { UnityConsoleEntry } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import {
	consoleErrorCount,
	consoleLine,
	matchesConsoleFilter,
} from './console-log';

const entry: UnityConsoleEntry = {
	level: 'error',
	message: 'NullReferenceException in PlayerController',
	file: 'Assets/Player.cs',
	line: 58,
	timestamp: '14:02:11',
};

describe('matchesConsoleFilter', () => {
	it('combines the level tabs with the text filter', () => {
		expect(matchesConsoleFilter(entry, 'error', 'null')).toBe(true);
		expect(matchesConsoleFilter(entry, 'warn', '')).toBe(false);
		expect(matchesConsoleFilter(entry, 'all', 'shader')).toBe(false);
	});

	it('matches the file as well as the message', () => {
		expect(matchesConsoleFilter(entry, 'all', 'player.cs')).toBe(true);
	});
});

describe('consoleLine', () => {
	it('keeps the timestamp, level and location when copied out', () => {
		expect(consoleLine(entry)).toBe(
			'14:02:11 [error] NullReferenceException in PlayerController (Assets/Player.cs:58)',
		);
	});
});

describe('consoleErrorCount', () => {
	it('counts only errors', () => {
		expect(consoleErrorCount([entry, { level: 'warn', message: 'x' }])).toBe(1);
	});
});
