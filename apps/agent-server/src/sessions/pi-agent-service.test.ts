import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type {
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
} from '@gizmo/protocol';
import {
	PiAgentService,
	type PiSessionFactory,
	type PiSessionLike,
} from './pi-agent-service';
import type { SessionRepository } from './session-repository';

function fakeManager(sessionId: string): SessionManager {
	return { getSessionId: () => sessionId } as unknown as SessionManager;
}

/** An in-memory stand-in for `PiSessionRepository`, tracking calls the tests assert on. */
class FakeRepository implements SessionRepository {
	openCalls = 0;
	snapshotCalls = 0;
	#sessions = new Map<string, { title: string }>();
	#nextId = 0;

	async create(): Promise<SessionManager> {
		const id = `session-${++this.#nextId}`;
		this.#sessions.set(id, { title: 'New session' });
		return fakeManager(id);
	}

	async open(sessionId: string): Promise<SessionManager> {
		this.openCalls++;
		if (!this.#sessions.has(sessionId)) {
			throw new Error(`Unknown session: ${sessionId}`);
		}
		return fakeManager(sessionId);
	}

	async list(): Promise<SessionCatalog> {
		return { sessions: [] };
	}

	async snapshot(sessionId: string): Promise<SessionSnapshot> {
		this.snapshotCalls++;
		const entry = this.#sessions.get(sessionId);
		if (!entry) throw new Error(`Unknown session: ${sessionId}`);
		return {
			session: {
				id: sessionId,
				title: entry.title,
				createdAt: 0,
				lastActiveAt: 0,
				messageCount: 0,
			},
			messages: [],
		};
	}

	async snapshotOf(_manager: SessionManager, sessionId: string) {
		return this.snapshot(sessionId);
	}

	async rename(sessionId: string, title: string): Promise<void> {
		const entry = this.#sessions.get(sessionId);
		if (entry) entry.title = title;
	}

	async delete(sessionId: string): Promise<void> {
		this.#sessions.delete(sessionId);
	}

	async setLastSession(): Promise<void> {}
}

function fakeSession(sessionId: string): PiSessionLike & { isStreaming: boolean } {
	return {
		sessionId,
		isStreaming: false,
		subscribe: () => () => {},
		prompt: async () => {},
		steer: async () => {},
		abort: async () => {},
		dispose: vi.fn(),
	};
}

function fakeFactory(sessions: Map<string, ReturnType<typeof fakeSession>>) {
	const factory: PiSessionFactory = async (
		_options: SessionOptions,
		manager: SessionManager,
	) => {
		const id = manager.getSessionId();
		const existing = sessions.get(id);
		if (existing) return existing;
		const created = fakeSession(id);
		sessions.set(id, created);
		return created;
	};
	return factory;
}

describe('PiAgentService idle eviction', () => {
	let repository: FakeRepository;
	let sessions: Map<string, ReturnType<typeof fakeSession>>;
	let service: PiAgentService;

	beforeEach(() => {
		vi.useFakeTimers();
		repository = new FakeRepository();
		sessions = new Map();
	});

	afterEach(() => {
		service?.dispose();
		vi.useRealTimers();
	});

	function createService(options?: ConstructorParameters<typeof PiAgentService>[4]) {
		service = new PiAgentService(
			fakeFactory(sessions),
			repository,
			undefined,
			undefined,
			options,
		);
		return service;
	}

	it('evicts an idle session and transparently reconstructs it on the next prompt', async () => {
		createService({ idleTimeoutMs: 1_000, sweepIntervalMs: 500 });
		const sessionId = await service.createSession();
		repository.openCalls = 0;

		vi.advanceTimersByTime(1_500);
		expect(sessions.get(sessionId)?.dispose).toHaveBeenCalledOnce();

		await service.prompt(sessionId, 'hello');
		expect(repository.openCalls).toBe(1);
	});

	it('never evicts a streaming session, even past the idle timeout', async () => {
		createService({ idleTimeoutMs: 1_000, sweepIntervalMs: 500 });
		const sessionId = await service.createSession();
		const session = sessions.get(sessionId)!;
		session.isStreaming = true;

		vi.advanceTimersByTime(2_000);
		expect(session.dispose).not.toHaveBeenCalled();
	});

	it('evicts the least-recently-active session to stay under the cap', async () => {
		createService({ maxActiveSessions: 2, idleTimeoutMs: 60_000 });
		const first = await service.createSession();
		vi.advanceTimersByTime(10);
		await service.createSession();
		vi.advanceTimersByTime(10);
		await service.createSession();

		expect(sessions.get(first)?.dispose).toHaveBeenCalledOnce();
	});

	it('does not re-read from the repository when the session is already active', async () => {
		createService();
		const sessionId = await service.createSession();
		repository.snapshotCalls = 0;
		repository.openCalls = 0;

		await service.prompt(sessionId, 'hello');

		expect(repository.snapshotCalls).toBe(0);
		expect(repository.openCalls).toBe(0);
	});
});
