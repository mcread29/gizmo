import type { CompactionPolicy } from '@gizmo/protocol';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PiAgentService } from '../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../src/sessions/session-repository';
import {
	createTemporaryDirectory,
	createTestService,
	FakePiSession,
} from './support/pi-agent-service-fixtures';

describe('PiAgentService commands', () => {
	it('routes commands into the Pi session', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession({ cwd: '/projects/sandbox' });

		await service.prompt(sessionId, 'Inspect this');
		await service.steer(sessionId, 'Focus on the player');
		await service.abort(sessionId);
		service.dispose();

		expect(pi.prompt).toHaveBeenCalledWith('Inspect this');
		expect(pi.steer).toHaveBeenCalledWith('Focus on the player');
		expect(pi.abort).toHaveBeenCalledOnce();
		expect(pi.dispose).toHaveBeenCalledOnce();
	});

	it('configures automatic compaction and routes manual compaction', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();
		const policy: CompactionPolicy = {
			enabled: true,
			fillPercent: 25,
			retainPercent: 10,
		};

		await service.prompt(sessionId, 'Long task', policy);
		await service.compact(sessionId, policy);

		expect(pi.configureCompaction).toHaveBeenCalledTimes(2);
		expect(pi.configureCompaction).toHaveBeenLastCalledWith(policy);
		expect(pi.compact).toHaveBeenCalledOnce();
	});

	it('stores attachments with the session and sends images to Pi', async () => {
		const dataDir = await createTemporaryDirectory();
		const pi = new FakePiSession();
		let sessionDir = dataDir;
		const service = new PiAgentService(async (_options, manager) => {
			pi.sessionId = manager.getSessionId();
			sessionDir = manager.getSessionDir();
			return pi;
		}, new PiSessionRepository(dataDir));
		const sessionId = await service.createSession();
		const data = Buffer.from('image bytes').toString('base64');

		await service.prompt(sessionId, 'Inspect this', undefined, [
			{ name: '../reference.png', mimeType: 'image/png', data },
		]);

		const directory = join(sessionDir, 'attachments', sessionId);
		const names = await readdir(directory);
		expect(names).toHaveLength(1);
		expect(names[0]).not.toContain('..');
		expect(await readFile(join(directory, names[0]!))).toEqual(
			Buffer.from('image bytes'),
		);
		expect(pi.prompt).toHaveBeenCalledWith(
			expect.stringContaining('<gizmo-attachments>'),
			{
				images: [{ type: 'image', mimeType: 'image/png', data }],
			},
		);
	});

	it('rejects retention at or above the compaction threshold', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();

		await expect(
			service.compact(sessionId, {
				enabled: true,
				fillPercent: 25,
				retainPercent: 25,
			}),
		).rejects.toThrow('Retained context must be below');
	});

	it('disposes a deleted session immediately', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();

		await service.deleteSession(sessionId);

		expect(pi.dispose).toHaveBeenCalledOnce();
		await expect(service.prompt(sessionId, 'No longer active')).rejects.toThrow(
			'Unknown session',
		);
	});

	it('updates model and thinking settings on the live Pi session', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();

		await service.selectModel(sessionId, 'openai-codex', 'gpt-5.6-terra');
		const catalog = await service.selectThinkingLevel(sessionId, 'low');

		expect(pi.selectModel).toHaveBeenCalledWith(
			'openai-codex',
			'gpt-5.6-terra',
		);
		expect(pi.selectThinkingLevel).toHaveBeenCalledWith('low');
		expect(catalog.current).toMatchObject({
			id: 'gpt-5.6-terra',
			thinkingLevel: 'low',
		});
	});
});
