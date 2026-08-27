import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
	parseAgentEvent,
	type AgentEvent,
	type AgentModelCatalog,
	type CompactionPolicy,
} from '@gizmo/protocol';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PiAgentService,
	type PiSessionLike,
} from '../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../src/sessions/session-repository';
import { registerExtensions } from '../../src/extensions/registry';
import { ProjectCatalog } from '../../src/projects/project-catalog';

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
	const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
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
	it('resolves extension tool and prompt policy from the active profile', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-profile-policy-'));
		const projectPath = await mkdtemp(join(tmpdir(), 'gizmo-project-'));
		temporaryDirectories.push(dataDir, projectPath);
		registerExtensions([
			{
				id: 'notes',
				name: 'Notes',
				profile: (root) => ({
					id: 'notes',
					name: 'Notes',
					source: 'extension:notes',
					base: 'default',
					extensions: [{ id: 'notes', root }],
					tools: { mode: 'default-plus-extension' },
					prompt: { mode: 'default-plus-extension-fragments' },
				}),
			},
		]);
		const projects = new ProjectCatalog(dataDir);
		await projects.add(projectPath, [{ id: 'notes', root: '.' }]);
		const options: Array<{
			extensionTools?: boolean;
			extensionPrompt?: boolean;
		}> = [];
		const service = new PiAgentService(
			async (runtimeOptions, manager) => {
				options.push(runtimeOptions);
				return new FakePiSession(manager.getSessionId());
			},
			new PiSessionRepository(dataDir),
			projects,
		);

		await service.createSession({ cwd: projectPath });
		expect(options.at(-1)).toMatchObject({
			extensionTools: true,
			extensionPrompt: true,
		});

		const profiles = await projects.profilesFor(projectPath);
		const active = profiles.profiles.find(
			({ id }) => id === profiles.activeProfileId,
		)!;
		const override = {
			...active,
			id: 'notes-override',
			source: 'workspace:temporary',
			base: active.id,
			tools: { mode: 'default' as const },
			prompt: { mode: 'pi-default' as const },
		};
		await projects.saveProfiles(projectPath, {
			...profiles,
			activeProfileId: override.id,
			profiles: [...profiles.profiles, override],
		});
		await service.createSession({ cwd: projectPath });
		expect(options.at(-1)).toMatchObject({
			extensionTools: false,
			extensionPrompt: false,
		});
		service.dispose();
		registerExtensions([]);
	});

	it('blocks a Unity compile until the app resolves its confirmation', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
		temporaryDirectories.push(dataDir);
		const pi = new FakePiSession();
		let requestConfirmation!: (projectPath: string) => Promise<boolean>;
		const service = new PiAgentService(async (_options, manager, callbacks) => {
			pi.sessionId = manager.getSessionId();
			requestConfirmation = callbacks.confirmStopPlayMode;
			return pi;
		}, new PiSessionRepository(dataDir));
		const events: AgentEvent[] = [];
		service.subscribe((agentEvent) => events.push(agentEvent));
		const sessionId = await service.createSession({ cwd: '/projects/game' });

		const decision = requestConfirmation('/projects/game');
		const confirmation = events.find(
			(agentEvent) => agentEvent.type === 'confirmation.requested',
		);
		expect(confirmation).toMatchObject({
			type: 'confirmation.requested',
			sessionId,
			kind: 'stop_play_mode_for_compile',
		});
		service.resolveConfirmation(sessionId, confirmation!.confirmationId, true);
		await expect(decision).resolves.toBe(true);
	});

	it('accepts a browser UI response while a session is still starting', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-extension-ui-test-'));
		temporaryDirectories.push(dataDir);
		const pi = new FakePiSession();
		let decision: boolean | undefined;
		const service = new PiAgentService(async (_options, manager, callbacks) => {
			pi.sessionId = manager.getSessionId();
			decision = await callbacks.extensionUi.context.confirm(
				'Trust helper?',
				'Allow this extension to continue?',
			);
			return pi;
		}, new PiSessionRepository(dataDir));
		const events: AgentEvent[] = [];
		service.subscribe((agentEvent) => events.push(agentEvent));

		const creation = service.createSession({ cwd: '/projects/game' });
		await vi.waitFor(() =>
			expect(
				events.some(
					(agentEvent) => agentEvent.type === 'extension.ui.requested',
				),
			).toBe(true),
		);
		const request = events.find(
			(agentEvent) => agentEvent.type === 'extension.ui.requested',
		);
		if (request?.type !== 'extension.ui.requested')
			throw new Error('missing UI');
		await service.resolveExtensionUi(
			request.sessionId,
			request.runtimeId,
			request.uiRequestId,
			{ kind: 'confirmed', confirmed: true },
		);

		await creation;
		expect(decision).toBe(true);
	});

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
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
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

	it('does not leave a persisted session when Pi creation fails', async () => {
		const dataDir = await mkdtemp(join(tmpdir(), 'gizmo-test-'));
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
