import type {
	UnityCommandRunner,
	UnityRunResult,
} from '@unity-agent/unity-tools';
import { describe, expect, it, vi } from 'vitest';
import { UnityProjectService } from '../../src/unity/unity-project-service';

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

	it('emits only changed project status while watching', async () => {
		const runner = runnerReturning(
			projectsResult(),
			statusResult([{ projectPath: '/projects/game', state: 'ready' }]),
			statusResult([]),
		);
		const service = new UnityProjectService(runner, 1);
		const changed = new Promise<string>((resolve) => {
			void service.watchStatus('/projects/game', {
				status: (status) => resolve(status.state),
				console: () => {},
			});
		});

		await expect(changed).resolves.toBe('disconnected');
		service.dispose();
	});

	it('refuses to revert a file outside the project', async () => {
		const service = new UnityProjectService(runnerReturning(projectsResult()));
		await service.listProjects();

		await expect(
			service.revertFile(
				'/projects/game',
				'../../etc/hosts',
				'@@ -1 +1 @@\n-a\n+b',
			),
		).rejects.toThrow('outside the selected project');
	});
});

function projectsResult(): UnityRunResult {
	return runResult({
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
	});
}

function statusResult(instances: Record<string, unknown>[]): UnityRunResult {
	return runResult({
		ok: instances.length > 0,
		exitCode: instances.length > 0 ? 0 : 6,
		stdout: JSON.stringify({
			success: instances.length > 0,
			command: 'status',
			data: { count: instances.length, instances },
			errors: instances.length
				? []
				: [
						{
							code: 'STATUS_NO_INSTANCES',
							message: 'No Unity Editor instances found.',
						},
					],
			warnings: [],
		}),
	});
}

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
