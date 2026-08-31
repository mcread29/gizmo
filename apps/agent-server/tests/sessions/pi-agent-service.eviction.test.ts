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
} from '../../src/sessions/pi-agent-service';
import type { SessionRepository } from '../../src/sessions/session-repository';

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

function fakeSession(
	sessionId: string,
): PiSessionLike & { isStreaming: boolean } {
	return {
		sessionId,
		isStreaming: false,
		subscribe: () => () => {},
		prompt: async () => {},
		steer: async () => {},
		abort: vi.fn(async () => {}),
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

	function createService(
		options?: ConstructorParameters<typeof PiAgentService>[4],
	) {
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

	describe('abortStreamingSessions', () => {
		it('aborts only sessions that are currently streaming', async () => {
			createService();
			const streamingId = await service.createSession();
			const idleId = await service.createSession();
			sessions.get(streamingId)!.isStreaming = true;

			await service.abortStreamingSessions();

			expect(sessions.get(streamingId)?.abort).toHaveBeenCalledOnce();
			expect(sessions.get(idleId)?.abort).not.toHaveBeenCalled();
		});

		it('does not block past the timeout on a hung abort', async () => {
			createService();
			const sessionId = await service.createSession();
			const session = sessions.get(sessionId)!;
			session.isStreaming = true;
			session.abort = vi.fn(() => new Promise<void>(() => {}));

			const pending = service.abortStreamingSessions();
			vi.advanceTimersByTime(10_000);
			await pending;

			expect(session.abort).toHaveBeenCalledOnce();
		});

		it('does not let one failing abort stop another session from being aborted', async () => {
			createService();
			const failingId = await service.createSession();
			const otherId = await service.createSession();
			sessions.get(failingId)!.isStreaming = true;
			sessions.get(failingId)!.abort = vi.fn(async () => {
				throw new Error('boom');
			});
			sessions.get(otherId)!.isStreaming = true;
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await service.abortStreamingSessions();

			expect(sessions.get(otherId)?.abort).toHaveBeenCalledOnce();
			expect(errorSpy).toHaveBeenCalled();
			errorSpy.mockRestore();
		});
	});
});
