import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCallManager } from '../../src/scripts/call-manager';

let workspace: string;

beforeEach(async () => {
	workspace = await mkdtemp(join(tmpdir(), 'gizmo-call-'));
});

async function removeWorkspace() {
	// A kill signal takes a moment to release the workspace on Windows;
	// retry the removal rather than failing the test on EBUSY.
	for (let attempt = 0; ; attempt++) {
		try {
			await rm(workspace, { recursive: true, force: true });
			return;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EBUSY' || attempt >= 5)
				throw error;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
	}
}

afterEach(async () => {
	await removeWorkspace();
});

async function script(name: string, contents: string): Promise<string> {
	await writeFile(join(workspace, name), contents, 'utf8');
	return name;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('call manager', () => {
	it('runs a workspace TypeScript file through bun with no shell', async () => {
		await script('build.ts', `console.log('done');`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'build.ts',
			});
			expect(started.status).toBe('running');
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('done');
			expect(record?.stdout).toContain('done');
		} finally {
			await manager.disposeAll();
		}
	});

	it('passes arguments as argv entries rather than a shell string', async () => {
		await script('run.ts', `console.log(process.argv.slice(2).join('|'));`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'run.ts',
				args: ['--out', 'a b; rm -rf /'],
			});
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('done');
			expect(record?.stdout).toContain('--out|a b; rm -rf /');
		} finally {
			await manager.disposeAll();
		}
	});

	it('refuses shell scripts', async () => {
		await script('install.sh', 'echo hi');
		const manager = createCallManager();
		try {
			await expect(
				manager.spawn({ workspacePath: workspace, script: 'install.sh' }),
			).rejects.toThrow(/Shell scripts are not supported/);
		} finally {
			await manager.disposeAll();
		}
	});

	it('refuses paths that escape the workspace', async () => {
		const manager = createCallManager();
		try {
			await expect(
				manager.spawn({ workspacePath: workspace, script: '../outside.ts' }),
			).rejects.toThrow(/inside the workspace/);
		} finally {
			await manager.disposeAll();
		}
	});

	it('refuses a script that does not exist', async () => {
		const manager = createCallManager();
		try {
			await expect(
				manager.spawn({ workspacePath: workspace, script: 'missing.ts' }),
			).rejects.toThrow(/No such script/);
		} finally {
			await manager.disposeAll();
		}
	});

	it('reports a non-zero exit without throwing', async () => {
		await script('fail.ts', `console.error('boom'); process.exit(2);`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'fail.ts',
			});
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('error');
			expect(record?.exitCode).toBe(2);
			expect(record?.stderr).toContain('boom');
		} finally {
			await manager.disposeAll();
		}
	});

	it('waitFor resolves immediately for already-settled calls', async () => {
		await script('quick.ts', `console.log('q');`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'quick.ts',
			});
			await manager.waitFor([started.id]);
			const again = await manager.waitFor([started.id]);
			expect(again[0]?.status).toBe('done');
		} finally {
			await manager.disposeAll();
		}
	});

	it('rejects waits for unknown ids', async () => {
		const manager = createCallManager();
		try {
			await expect(manager.waitFor(['call_nope'])).rejects.toThrow(
				/Unknown call id/,
			);
		} finally {
			await manager.disposeAll();
		}
	});

	it('cancel stops a running call and waitFor reports cancelled', async () => {
		await script('slow.ts', `await new Promise((r) => setTimeout(r, 30000));`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'slow.ts',
			});
			await delay(300);
			expect(manager.get(started.id)?.status).toBe('running');
			expect(manager.cancel([started.id])).toEqual([started.id]);
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('cancelled');
		} finally {
			await manager.disposeAll();
		}
	});

	it('aborting the wait leaves the call running', async () => {
		await script('slow.ts', `await new Promise((r) => setTimeout(r, 30000));`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'slow.ts',
			});
			const controller = new AbortController();
			const pending = manager.waitFor([started.id], controller.signal);
			controller.abort();
			await expect(pending).rejects.toThrow(/aborted/i);
			expect(manager.get(started.id)?.status).toBe('running');
			manager.cancel([started.id]);
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('cancelled');
		} finally {
			await manager.disposeAll();
		}
	});

	it('reports whether a settle was consumed by a waiter', async () => {
		await script('slow.ts', `await new Promise((r) => setTimeout(r, 500));`);
		await script('quick.ts', `console.log('q');`);
		const manager = createCallManager();
		const settled: Array<{ id: string; consumed: boolean }> = [];
		manager.onSettled = (record, consumed) => {
			settled.push({ id: record.id, consumed });
		};
		try {
			const slow = await manager.spawn({
				workspacePath: workspace,
				script: 'slow.ts',
			});
			await manager.waitFor([slow.id]);
			const quick = await manager.spawn({
				workspacePath: workspace,
				script: 'quick.ts',
			});
			await manager.waitFor([quick.id]);
			expect(settled.find((entry) => entry.id === slow.id)?.consumed).toBe(
				true,
			);
		} finally {
			await manager.disposeAll();
		}
	});

	it('lists calls and truncates very large output', async () => {
		await script('loud.ts', `console.log('x'.repeat(90000));`);
		const manager = createCallManager();
		try {
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'loud.ts',
			});
			expect(manager.list().some((call) => call.id === started.id)).toBe(true);
			const [record] = await manager.waitFor([started.id]);
			expect(record?.truncated).toBe(true);
		} finally {
			await manager.disposeAll();
		}
	});

	it('explains a missing bun binary', async () => {
		await script('build.ts', `console.log('hi');`);
		const manager = createCallManager();
		const originalPath = process.env.PATH;
		try {
			process.env.PATH = '';
			const started = await manager.spawn({
				workspacePath: workspace,
				script: 'build.ts',
			});
			const [record] = await manager.waitFor([started.id]);
			expect(record?.status).toBe('error');
			expect(record?.error ?? '').toMatch(/Bun is required/);
		} finally {
			process.env.PATH = originalPath;
			await manager.disposeAll();
		}
	});

	it('disposeAll rejects pending waits', async () => {
		await script('slow.ts', `await new Promise((r) => setTimeout(r, 30000));`);
		const manager = createCallManager();
		const started = await manager.spawn({
			workspacePath: workspace,
			script: 'slow.ts',
		});
		const pending = manager.waitFor([started.id]);
		void manager.disposeAll();
		await expect(pending).rejects.toThrow(/disposed/);
	});
});
