import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
	parseAgentEvent,
	type AgentEvent,
	type AgentModelCatalog,
	type CompactionPolicy,
} from '@unity-agent/protocol';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PiAgentService, type PiSessionLike } from './pi-agent-service';
import { PiSessionRepository } from './session-repository';

class FakePiSession implements PiSessionLike {
	sessionId: string;
	sessionName = 'New session';
	model = { provider: 'openai-codex', id: 'gpt-5.6-sol' };
	thinkingLevel = 'high';
	isStreaming = false;
	readonly prompt = vi.fn(async () => {});
	readonly steer = vi.fn(async () => {});
	readonly abort = vi.fn(async () => {});
	readonly compact = vi.fn(async () => ({}));
	readonly configureCompaction = vi.fn((_policy: CompactionPolicy) => {});
	readonly setSessionName = vi.fn((name: string) => (this.sessionName = name));
	readonly dispose = vi.fn();
	readonly getModelCatalog = vi.fn(async (): Promise<AgentModelCatalog> => ({
		current: { ...this.model, thinkingLevel: this.thinkingLevel },
		models: [
			{
				...this.model,
				name: this.model.id,
				reasoning: true,
			},
		],
		thinkingLevels: ['low', 'high'],
	}));
	readonly selectModel = vi.fn(async (provider: string, modelId: string) => {
		this.model = { provider, id: modelId };
	});
	readonly selectThinkingLevel = vi.fn((level: string) => {
		this.thinkingLevel = level;
	});
	#listener?: (event: AgentSessionEvent) => void;

	constructor(sessionId = 'pi-session-1') {
		this.sessionId = sessionId;
	}

	subscribe(listener: (event: AgentSessionEvent) => void) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}

	emit(event: AgentSessionEvent) {
		this.#listener?.(event);
	}
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

async function createTestService(pi: FakePiSession) {
	const dataDir = await mkdtemp(join(tmpdir(), 'unity-agent-test-'));
	temporaryDirectories.push(dataDir);
	return new PiAgentService(async (_options, manager) => {
		pi.sessionId = manager.getSessionId();
		return pi;
	}, new PiSessionRepository(dataDir));
}

function event(value: unknown): AgentSessionEvent {
	return value as AgentSessionEvent;
}

describe('PiAgentService', () => {
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
		const dataDir = await mkdtemp(join(tmpdir(), 'unity-agent-test-'));
		temporaryDirectories.push(dataDir);
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
			expect.stringContaining('<unity-agent-attachments>'),
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

	it('does not leave a persisted session when Pi creation fails', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'unity-agent-test-'));
		temporaryDirectories.push(dataDir);
		const repository = new PiSessionRepository(dataDir);
		const service = new PiAgentService(async () => {
			throw new Error('No model available');
		}, repository);

		await expect(
			service.createSession({ cwd: '/projects/game' }),
		).rejects.toThrow('No model available');
		expect((await repository.list()).sessions).toEqual([]);
	});

	it('translates Pi streaming and tool events into the shared protocol', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const events: AgentEvent[] = [];
		service.subscribe((input) => events.push(parseAgentEvent(input)));
		await service.createSession();

		const assistant = {
			role: 'assistant',
			content: [],
			timestamp: 2,
			api: 'anthropic-messages',
			provider: 'anthropic',
			model: 'test',
			usage: {},
			stopReason: 'stop',
		};
		pi.emit(event({ type: 'agent_start' }));
		pi.emit(
			event({
				type: 'message_start',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(
			event({
				type: 'message_end',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(event({ type: 'message_start', message: assistant }));
		pi.emit(
			event({
				type: 'message_update',
				message: assistant,
				assistantMessageEvent: {
					type: 'text_delta',
					delta: 'Working',
					contentIndex: 0,
					partial: assistant,
				},
			}),
		);
		pi.emit(event({ type: 'message_end', message: assistant }));
		pi.emit(
			event({
				type: 'tool_execution_start',
				toolCallId: 'tool-1',
				toolName: 'unity_status',
				args: {},
			}),
		);
		pi.emit(
			event({
				type: 'tool_execution_end',
				toolCallId: 'tool-1',
				toolName: 'unity_status',
				result: {
					content: [{ type: 'text', text: 'Connected' }],
					details: { state: 'connected', instances: [{ port: 6400 }] },
				},
				isError: false,
			}),
		);
		pi.emit(event({ type: 'agent_settled' }));

		expect(events.map((item) => item.type)).toEqual([
			'session.created',
			'session.state',
			'session.state',
			'message.started',
			'message.delta',
			'message.completed',
			'message.started',
			'message.delta',
			'message.completed',
			'session.usage',
			'tool.started',
			'tool.completed',
			'session.state',
		]);
		expect(events.find((item) => item.type === 'tool.completed')).toMatchObject(
			{
				result: { state: 'connected', instances: [{ port: 6400 }] },
				isError: false,
			},
		);
	});
});
