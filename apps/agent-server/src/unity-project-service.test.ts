import type {
	UnityCommandRunner,
	UnityRunResult,
} from '@unity-agent/unity-tools';
import { describe, expect, it, vi } from 'vitest';
import { UnityProjectService } from './unity-project-service';

describe('UnityProjectService', () => {
	it('rejects paths outside the Unity project registry before status or open', async () => {
		const runner = runnerReturning(
			runResult({
				stdout: JSON.stringify({
					success: true,
					command: 'projects list',
					data: [
						{
							title: 'Registered',
							path: '/projects/registered',
							isFavorite: false,
						},
					],
					errors: [],
					warnings: [],
				}),
			}),
		);
		const service = new UnityProjectService(runner);

		await service.listProjects();
		await expect(service.openProject('/tmp/not-registered')).rejects.toThrow(
			'not a registered Unity project',
		);

		expect(runner.run).toHaveBeenCalledOnce();
	});

	it('checks status for the exact registered project path', async () => {
		const runner = runnerReturning(
			runResult({
				stdout: JSON.stringify({
					success: true,
					command: 'projects list',
					data: [
						{
							title: 'Game',
							path: '/projects/game',
							isFavorite: false,
						},
					],
					errors: [],
					warnings: [],
				}),
			}),
			runResult({
				stdout: JSON.stringify({
					success: true,
					command: 'status',
					data: { count: 1, instances: [{ projectPath: '/projects/game' }] },
					errors: [],
					warnings: [],
				}),
			}),
		);
		const service = new UnityProjectService(runner);

		await service.listProjects();
		const status = await service.getStatus('/projects/game');

		expect(status.state).toBe('connected');
		expect(runner.run).toHaveBeenNthCalledWith(
			2,
			expect.arrayContaining(['--project-path', '/projects/game']),
			{ signal: expect.any(AbortSignal) },
		);
	});
});

function runnerReturning(...results: UnityRunResult[]): UnityCommandRunner & {
	run: ReturnType<typeof vi.fn>;
} {
	return { run: vi.fn(async () => results.shift()!) };
}

function runResult(overrides: Partial<UnityRunResult>): UnityRunResult {
	return {
		ok: true,
		executable: 'unity',
		args: [],
		exitCode: 0,
		signal: null,
		stdout: '',
		stderr: '',
		durationMs: 1,
		aborted: false,
		timedOut: false,
		outputLimitExceeded: false,
		...overrides,
	};
}
