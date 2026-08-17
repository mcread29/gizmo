import { describe, expect, it } from 'vitest';
import { createUnityListCommandsTool } from './unity-list-commands-tool';
import type { UnityCommandRunner } from './unity-runner';

describe('unity_list_commands tool', () => {
	it('returns discovered commands as structured details', async () => {
		const runner: UnityCommandRunner = {
			async run(args) {
				return {
					ok: true,
					executable: 'unity',
					args,
					exitCode: 0,
					signal: null,
					stdout: JSON.stringify({
						success: true,
						command: 'unity list',
						data: { commands: [{ name: 'scene.validate' }] },
						errors: [],
						warnings: [],
					}),
					stderr: '',
					durationMs: 1,
					aborted: false,
					timedOut: false,
					outputLimitExceeded: false,
				};
			},
		};
		const tool = createUnityListCommandsTool({ runner });

		const result = await tool.execute(
			'tool-1',
			{},
			undefined,
			undefined,
			{} as never,
		);

		expect(result.content[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('scene.validate'),
		});
		expect(result.details).toMatchObject({
			state: 'available',
			commands: [{ name: 'scene.validate' }],
		});
	});
});
