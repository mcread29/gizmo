import type { SessionOptions } from '@gizmo/protocol';
import type { ProjectCatalog } from '../projects/project-catalog';
import type { PiSessionFactory } from './pi-agent-types';
import type { SessionRepository } from './session-repository';
import type { SessionRuntimePool } from './session-runtime-pool';

/** Creates and restores persisted sessions while the pool owns live runtimes. */
export class SessionCatalogService {
	readonly #factory: PiSessionFactory;
	readonly #repository: SessionRepository;
	readonly #projects: ProjectCatalog;
	readonly #pool: SessionRuntimePool;

	constructor(
		factory: PiSessionFactory,
		repository: SessionRepository,
		projects: ProjectCatalog,
		pool: SessionRuntimePool,
	) {
		this.#factory = factory;
		this.#repository = repository;
		this.#projects = projects;
		this.#pool = pool;
	}

	async createSession(options: SessionOptions = {}) {
		const cwd = options.cwd ?? process.cwd();
		const integrations =
			options.integrations ??
			(options.domainId && options.domainId !== 'generic'
				? [{ id: options.domainId, root: '.' }]
				: await this.#projects.integrationsFor(cwd));
		const disabledPiExtensions =
			await this.#projects.disabledPiExtensionsFor(cwd);
		const manager = await this.#repository.create(cwd);
		const sessionId = manager.getSessionId();
		try {
			const callbacks = this.#pool.callbacks(sessionId);
			const session = await this.#factory(
				{ cwd, integrations, disabledPiExtensions },
				manager,
				callbacks,
			);
			this.#pool.activate(
				session,
				manager,
				'New session',
				callbacks.extensionUi,
			);
			await this.#repository.setLastSession(session.sessionId);
			return session.sessionId;
		} catch (error) {
			this.#pool.discardPendingRuntime(sessionId);
			await this.#repository.delete(sessionId);
			throw error;
		}
	}

	async listSessions() {
		const catalog = await this.#repository.list();
		return {
			...catalog,
			sessions: await Promise.all(
				catalog.sessions.map(async (session) => ({
					...session,
					integrations: await this.#projects.integrationsFor(
						session.workspacePath ?? session.projectPath,
					),
					// A resident runtime knows whether it is mid-turn; anything
					// not resident is idle by definition.
					state: this.#stateOf(session.id),
				})),
			),
		};
	}

	/** Reads a session for display without resuming it. */
	async readSession(sessionId: string) {
		const snapshot = await this.#repository.snapshot(sessionId);
		snapshot.session.integrations = await this.#projects.integrationsFor(
			snapshot.session.workspacePath ?? snapshot.session.projectPath,
		);
		snapshot.state = this.#stateOf(sessionId);
		return snapshot;
	}

	#stateOf(sessionId: string): 'idle' | 'streaming' {
		return this.#pool.has(sessionId) &&
			this.#pool.session(sessionId).isStreaming
			? 'streaming'
			: 'idle';
	}

	async resumeSession(sessionId: string) {
		const snapshot = await this.#repository.snapshot(sessionId);
		const workspacePath =
			snapshot.session.workspacePath ?? snapshot.session.projectPath;
		const integrations = await this.#projects.integrationsFor(workspacePath);
		const disabledPiExtensions = workspacePath
			? await this.#projects.disabledPiExtensionsFor(workspacePath)
			: [];
		snapshot.session.integrations = integrations;
		// Events emitted by activation or re-announcement follow this cutoff.
		snapshot.lastEventId = this.#pool.events.lastEventId;
		if (!this.#pool.has(sessionId)) {
			const manager = await this.#repository.open(sessionId);
			const callbacks = this.#pool.callbacks(sessionId);
			const session = await this.#factory(
				{ cwd: workspacePath, integrations, disabledPiExtensions },
				manager,
				callbacks,
			);
			this.#pool.activate(
				session,
				manager,
				snapshot.session.title,
				callbacks.extensionUi,
			);
		} else {
			this.#pool.attachSnapshot(sessionId, snapshot);
		}
		await this.#repository.setLastSession(sessionId);
		// Read last: activation above may have just started the runtime.
		snapshot.state = this.#stateOf(sessionId);
		return snapshot;
	}

	ensureActive(sessionId: string) {
		return this.#pool.ensureActive(sessionId, () =>
			this.resumeSession(sessionId),
		);
	}
}
