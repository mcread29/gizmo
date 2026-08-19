import { agentToolPolicy } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { unitySystemPrompt } from '../../src/unity/unity-system-prompt';

describe('unitySystemPrompt', () => {
	it('documents every tool exposed by the harness', () => {
		for (const tool of agentToolPolicy.tools) {
			expect(unitySystemPrompt).toContain(`- ${tool}:`);
		}
	});
});
