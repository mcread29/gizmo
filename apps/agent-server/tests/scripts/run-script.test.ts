import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runScript, type ScriptRunner } from '../../src/scripts/run-script';

let workspace: string;

beforeEach(async () => {
	workspace = await mkdtemp(join(tmpdir(), 'gizmo-run-script-'));
});

afterEach(async () => {
	await rm(workspace, { recursive: true, force: true });
});

const ok: ScriptRunner = async () => ({ stdout: 'done', stderr: '' });

async function script(name: string, contents = 'export {}'): Promise<string> {
	await writeFile(join(workspace, name), contents, 'utf8');
	return name;
}

describe('runScript', () => {
	it('runs a workspace TypeScript file through bun with no shell', async () => {
		const name = await script('build.ts');
		const run = vi.fn(ok);
		const result = await runScript(name, { workspacePath: workspace, run });

		expect(run).toHaveBeenCalledWith(
			'bun',
			['run', join(workspace, name)],
			expect.objectContaining({ cwd: workspace }),
		);
		expect(result).toMatchObject({ ok: true, exitCode: 0, stdout: 'done' });
	});

	it('passes arguments as argv entries rather than a shell string', async () => {
		const name = await script('run.ts');
		const run = vi.fn(ok);
		await runScript(name, {
			workspacePath: workspace,
			args: ['--out', 'a b; rm -rf /'],
			run,
		});

		expect(run).toHaveBeenCalledWith(
			'bun',
			['run', join(workspace, name), '--out', 'a b; rm -rf /'],
			expect.anything(),
		);
	});

	it('refuses shell scripts', async () => {
		const name = await script('install.sh', 'echo hi');
		await expect(
			runScript(name, { workspacePath: workspace, run: ok }),
		).rejects.toThrow(/Shell scripts are not supported/);
	});

	it('refuses paths that escape the workspace', async () => {
		await expect(
			runScript('../outside.ts', { workspacePath: workspace, run: ok }),
		).rejects.toThrow(/inside the workspace/);
	});

	it('refuses a script that does not exist', async () => {
		await expect(
			runScript('missing.ts', { workspacePath: workspace, run: ok }),
		).rejects.toThrow(/No such script/);
	});

	it('reports a non-zero exit without throwing', async () => {
		const name = await script('fail.ts');
		const result = await runScript(name, {
			workspacePath: workspace,
			run: async () => {
				throw Object.assign(new Error('failed'), {
					code: 2,
					stdout: 'partial',
					stderr: 'boom',
				});
			},
		});

		expect(result).toMatchObject({
			ok: false,
			exitCode: 2,
			stdout: 'partial',
			stderr: 'boom',
			timedOut: false,
		});
	});

	it('reports a timeout', async () => {
		const name = await script('slow.ts');
		const result = await runScript(name, {
			workspacePath: workspace,
			timeoutSeconds: 1,
			run: async () => {
				throw Object.assign(new Error('timed out'), {
					killed: true,
					signal: 'SIGTERM',
					stdout: '',
					stderr: '',
				});
			},
		});

		expect(result).toMatchObject({ ok: false, timedOut: true });
	});

	it('explains a missing bun binary', async () => {
		const name = await script('build.ts');
		await expect(
			runScript(name, {
				workspacePath: workspace,
				run: async () => {
					throw Object.assign(new Error('spawn bun ENOENT'), {
						code: 'ENOENT',
					});
				},
			}),
		).rejects.toThrow(/Bun is required/);
	});

	it('truncates very large output', async () => {
		const name = await script('loud.ts');
		const result = await runScript(name, {
			workspacePath: workspace,
			run: async () => ({ stdout: 'x'.repeat(50_000), stderr: '' }),
		});

		expect(result.truncated).toBe(true);
		expect(result.stdout).toContain('output truncated');
		expect(result.stdout.length).toBeLessThan(50_000);
	});

	it('marks a maxBuffer kill as truncated rather than a bare failure', async () => {
		const name = await script('flood.ts');
		const result = await runScript(name, {
			workspacePath: workspace,
			run: async () => {
				throw Object.assign(
					new Error('spawn bun ENOBUFS / maxBuffer exceeded'),
					{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' },
				);
			},
		});

		expect(result).toMatchObject({ ok: false, truncated: true });
		expect(result.stderr).toContain('truncated');
	});
});
