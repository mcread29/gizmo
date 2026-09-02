import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { AgentModelCatalog, CompactionPolicy } from '@gizmo/protocol';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, vi } from 'vitest';
import {
	PiAgentService,
	type PiSessionLike,
} from '../../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../../src/sessions/session-repository';

export class FakePiSession implements PiSessionLike {
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
	/** Text steered into the run in flight and not yet delivered. */
	queued: string[] = [];
	readonly clearQueue = vi.fn(() => ({
		steering: this.queued.splice(0),
		followUp: [] as string[],
	}));
	messages: ReadonlyArray<{
		role: string;
		content?: unknown;
		timestamp?: number;
		[key: string]: unknown;
	}> = [];
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

	get pendingMessageCount() {
		return this.queued.length;
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

export async function createTemporaryDirectory(prefix = 'gizmo-test-') {
	const directory = await mkdtemp(join(tmpdir(), prefix));
	temporaryDirectories.push(directory);
	return directory;
}

export async function createTestService(pi: FakePiSession) {
	const dataDir = await createTemporaryDirectory();
	return new PiAgentService(async (_options, manager) => {
		pi.sessionId = manager.getSessionId();
		return pi;
	}, new PiSessionRepository(dataDir));
}

export function piEvent(value: unknown): AgentSessionEvent {
	return value as AgentSessionEvent;
}
