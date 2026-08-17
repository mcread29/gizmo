import { describe, expect, it } from 'vitest';
import { createUnityStatusTool } from './unity-status-tool';
import type { UnityCommandRunner } from './unity-runner';

describe('unity_status tool', () => {
	it('returns model-readable text and structured UI details', async () => {
		const runner: UnityCommandRunner = {
			async run(args) {
				return {
					ok: false,
					executable: 'unity',
					args,
					exitCode: 6,
					signal: null,
					stdout: JSON.stringify({
						success: false,
						command: 'status',
						data: { count: 0, instances: [] },
						errors: [
							{
								code: 'STATUS_NO_INSTANCES',
								message: 'No connected Editor.',
							},
						],
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
		const tool = createUnityStatusTool({ runner });

		const result = await tool.execute(
			'tool-1',
			{},
			undefined,
			undefined,
			{} as never,
		);

		expect(result.content[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('STATUS_NO_INSTANCES'),
		});
		expect(result.details).toMatchObject({
			state: 'disconnected',
			exitCode: 6,
		});
	});
});
