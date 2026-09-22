import {
	type CompactionPolicy,
	defaultCompactionPolicy,
} from '@gizmo/protocol';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProjectCatalog } from '../../src/projects/project-catalog';
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
		await expect.poll(() => pi.dispose).toHaveBeenCalledOnce();
	});

	it('compacts under the workspace policy, re-read on every prompt', async () => {
		const pi = new FakePiSession();
		const { service, projects, workspace } = await createProjectService(pi);
		const policy: CompactionPolicy = {
			enabled: true,
			fillPercent: 40,
			retainPercent: 10,
		};
		await projects.setCompaction(workspace, policy);
		const sessionId = await service.createSession({ cwd: workspace });

		await service.prompt(sessionId, 'Long task');
		await service.compact(sessionId);

		expect(pi.configureCompaction).toHaveBeenCalledTimes(2);
		expect(pi.configureCompaction).toHaveBeenLastCalledWith(policy);
		expect(pi.compact).toHaveBeenCalledOnce();
	});

	it('falls back to the default policy for a workspace without one', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();

		await service.prompt(sessionId, 'Long task');

		expect(pi.configureCompaction).toHaveBeenCalledWith(
			defaultCompactionPolicy,
		);
		expect(defaultCompactionPolicy).toEqual({
			enabled: true,
			fillPercent: 60,
			retainPercent: 0,
		});
	});

	it('re-arms resident threads and broadcasts a policy change', async () => {
		const pi = new FakePiSession();
		const { service, workspace } = await createProjectService(pi);
		const sessionId = await service.createSession({ cwd: workspace });
		const listener = vi.fn();
		service.subscribe(listener);
		const policy: CompactionPolicy = {
			enabled: false,
			fillPercent: 70,
			retainPercent: 0,
		};

		await service.setProjectCompaction(workspace, policy);

		expect(pi.configureCompaction).toHaveBeenCalledWith(policy);
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'project.compaction.changed',
				projectPath: workspace,
				compaction: policy,
			}),
		);
		expect(await service.getProjectCompaction(workspace)).toEqual(policy);
		expect(await service.getProjectCompaction(sessionId)).toEqual(
			defaultCompactionPolicy,
		);
	});

	it('refuses a second compaction while one is running', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const sessionId = await service.createSession();

		pi.isCompacting = true;
		await expect(service.compact(sessionId)).rejects.toThrow(
			'Compaction is already in progress',
		);
		expect(pi.compact).not.toHaveBeenCalled();
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

		await service.prompt(sessionId, 'Inspect this', [
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
		const { service, workspace } = await createProjectService(pi);

		await expect(
			service.setProjectCompaction(workspace, {
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
		// Shutdown handlers (the journal tail flush) ran before disposal.
		expect(pi.shutdown).toHaveBeenCalledOnce();
		expect(pi.shutdown.mock.invocationCallOrder[0]).toBeLessThan(
			pi.dispose.mock.invocationCallOrder[0],
		);
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

/** A service whose workspace is registered, so its config can be written. */
async function createProjectService(pi: FakePiSession) {
	const dataDir = await createTemporaryDirectory();
	const workspace = await createTemporaryDirectory();
	const projects = new ProjectCatalog(dataDir);
	await projects.add(workspace);
	const service = new PiAgentService(
		async (_options, manager) => {
			pi.sessionId = manager.getSessionId();
			return pi;
		},
		new PiSessionRepository(dataDir),
		projects,
	);
	return { service, projects, workspace };
}
