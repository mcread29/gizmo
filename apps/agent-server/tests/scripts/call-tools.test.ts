import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallManager } from '../../src/scripts/call-manager';
import { createCallTools } from '../../src/scripts/call-tools';

let workspace: string;

beforeEach(async () => {
	workspace = await mkdtemp(join(tmpdir(), 'gizmo-call-tools-'));
	await writeFile(
		join(workspace, 'hello.ts'),
		`console.log('hi there');`,
		'utf8',
	);
	await writeFile(
		join(workspace, 'slow.ts'),
		`await new Promise((r) => setTimeout(r, 30000));`,
		'utf8',
	);
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

function context() {
	return { cwd: workspace, hasUI: false } as unknown as ExtensionContext;
}

describe('call tools', () => {
	it('call returns now and wait collects the output', async () => {
		const manager = createCallManager();
		const consume = vi.fn();
		try {
			const [call, wait] = createCallTools({ manager, consume });
			const launched = await call.execute(
				't1',
				{ script: 'hello.ts' },
				undefined,
				undefined,
				context(),
			);
			const id = (launched.details as { id: string }).id;
			expect(id).toMatch(/^call_/);
			const result = await wait.execute(
				't2',
				{ ids: [id] },
				undefined,
				undefined,
				context(),
			);
			expect(result.content[0]?.type).toBe('text');
			expect((result.content[0] as { text: string }).text).toContain(
				'hi there',
			);
			expect(consume).toHaveBeenCalledWith([id]);
		} finally {
			await manager.disposeAll();
		}
	});

	it('wait reports progress for running calls', async () => {
		const manager = createCallManager();
		const consume = vi.fn();
		try {
			const [call, wait] = createCallTools({ manager, consume });
			const launched = await call.execute(
				't1',
				{ script: 'slow.ts' },
				undefined,
				undefined,
				context(),
			);
			const id = (launched.details as { id: string }).id;
			const update = vi.fn();
			const controller = new AbortController();
			const pending = wait.execute(
				't2',
				{ ids: [id] },
				controller.signal,
				update,
				context(),
			);
			await Promise.resolve();
			await new Promise((resolve) => setTimeout(resolve, 100));
			controller.abort();
			await expect(pending).rejects.toThrow();
			expect(update).toHaveBeenCalledWith(
				expect.objectContaining({ details: { pending: [id] } }),
			);
		} finally {
			await manager.disposeAll();
		}
	});

	it('check, list and cancel cover the call lifecycle', async () => {
		const manager = createCallManager();
		const consume = vi.fn();
		try {
			const [call, wait, check, list, cancel] = createCallTools({
				manager,
				consume,
			});
			const launched = await call.execute(
				't1',
				{ script: 'slow.ts' },
				undefined,
				undefined,
				context(),
			);
			const id = (launched.details as { id: string }).id;
			const peeked = await check.execute(
				't2',
				{ id },
				undefined,
				undefined,
				context(),
			);
			expect((peeked.content[0] as { text: string }).text).toContain(
				'still running',
			);
			const listed = await list.execute(
				't3',
				{},
				undefined,
				undefined,
				context(),
			);
			expect((listed.content[0] as { text: string }).text).toContain(id);
			const cancelled = await cancel.execute(
				't4',
				{ ids: [id] },
				undefined,
				undefined,
				context(),
			);
			expect((cancelled.details as { cancelled: string[] }).cancelled).toEqual([
				id,
			]);
			const result = await wait.execute(
				't5',
				{ ids: [id] },
				undefined,
				undefined,
				context(),
			);
			expect((result.content[0] as { text: string }).text).toContain(
				'cancelled',
			);
		} finally {
			await manager.disposeAll();
		}
	});

	it('wait times out but leaves the call running', async () => {
		const manager = createCallManager();
		const consume = vi.fn();
		try {
			const [, wait] = createCallTools({ manager, consume });
			const [call] = createCallTools({ manager, consume });
			const launched = await call.execute(
				't1',
				{ script: 'slow.ts' },
				undefined,
				undefined,
				context(),
			);
			const id = (launched.details as { id: string }).id;
			await expect(
				wait.execute(
					't2',
					{ ids: [id], timeoutSeconds: 1 },
					undefined,
					undefined,
					context(),
				),
			).rejects.toThrow(/Timed out waiting/);
			expect(manager.get(id)?.status).toBe('running');
		} finally {
			await manager.disposeAll();
		}
	});
});
