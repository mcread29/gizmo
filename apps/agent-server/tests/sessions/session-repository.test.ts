import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PiSessionRepository } from '../../src/sessions/session-repository';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('PiSessionRepository', () => {
	it('restores durable transcripts and keeps projects isolated', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
		temporaryDirectories.push(dataDir);
		const repository = new PiSessionRepository(dataDir);
		const gamePath = resolve('/projects/game');
		const toolsPath = resolve('/projects/tools');
		const game = await repository.create(gamePath);
		game.appendMessage({
			role: 'user',
			content: 'Inspect the active scene',
			timestamp: 10,
		});
		const tools = await repository.create(toolsPath);
		tools.appendMessage({
			role: 'user',
			content: 'List build commands',
			timestamp: 20,
		});
		await repository.rename(game.getSessionId(), 'Scene inspection');
		await repository.setLastSession(game.getSessionId());

		const restarted = new PiSessionRepository(dataDir);
		const catalog = await restarted.list();
		const snapshot = await restarted.snapshot(game.getSessionId());

		expect(catalog.lastSessionId).toBe(game.getSessionId());
		expect(catalog.sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: game.getSessionId(),
					workspacePath: gamePath,
					title: 'Scene inspection',
				}),
				expect.objectContaining({
					id: tools.getSessionId(),
					workspacePath: toolsPath,
				}),
			]),
		);
		expect(snapshot.messages).toEqual([
			expect.objectContaining({
				role: 'user',
				content: 'Inspect the active scene',
			}),
		]);

		await restarted.delete(game.getSessionId());
		await expect(restarted.open(game.getSessionId())).rejects.toThrow(
			'Unknown session',
		);
		expect((await restarted.list()).lastSessionId).toBeUndefined();

		// Removal hides the transcript; the journal treats it as source material.
		const archived = await readdir(join(dataDir, 'sessions', 'archived'));
		expect(archived.some((name) => name.includes(game.getSessionId()))).toBe(
			true,
		);
	});
});
