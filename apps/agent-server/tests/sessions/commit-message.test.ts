import { describe, expect, it } from 'vitest';
import {
	cleanCommitMessage,
	commitMessagePrompt,
	providerSessionHeaders,
} from '../../src/sessions/commit-message';

describe('providerSessionHeaders', () => {
	it('adds the OpenCode session header for OpenCode providers', () => {
		expect(
			providerSessionHeaders({ provider: 'opencode-go' }, 'session-1'),
		).toEqual({ 'x-opencode-session': 'session-1', 'x-opencode-client': 'pi' });
		expect(
			providerSessionHeaders(
				{ provider: 'custom', baseUrl: 'https://opencode.ai/zen/v1' },
				'session-1',
			),
		).toHaveProperty('x-opencode-session', 'session-1');
	});

	it('leaves other providers alone', () => {
		expect(
			providerSessionHeaders(
				{ provider: 'anthropic', baseUrl: 'https://api.anthropic.com' },
				'session-1',
			),
		).toEqual({});
		expect(
			providerSessionHeaders({ provider: 'x', baseUrl: '::' }, 's'),
		).toEqual({});
	});
});

describe('commit message text', () => {
	it('strips fences and whitespace', () => {
		expect(cleanCommitMessage('```text\nfix: thing\n\nBody.\n```\n')).toBe(
			'fix: thing\n\nBody.',
		);
	});

	it('asks for the house style', () => {
		expect(commitMessagePrompt).toContain('Hard wrap lines at 72 characters.');
		expect(commitMessagePrompt).toContain(
			'Only respond with the commit message.',
		);
	});
});
