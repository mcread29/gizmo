import { sessionTitle } from '@gizmo/protocol';
import { compactRequested, rearmWorkspace } from './compaction-fallback';
import type {
	AgentAttachment,
	AgentModelCatalog,
	CompactionPolicy,
	ComposerCommand,
	ExtensionUiResponse,
	SessionSnapshot,
	SessionTree,
} from '@gizmo/protocol';
import { attachmentPrompt } from '../attachments/attachment-message';
import {
	prepareAttachments,
	readStoredAttachment,
	revealStoredAttachment,
} from '../attachments/attachment-storage';
import type { ProjectCatalog } from '../projects/project-catalog';
import { sessionTree } from './session-transcript';
import type { SessionRepository } from './session-repository';
import type { SessionCatalogService } from './session-catalog-service';
import { reloadAllSessions, reloadRuntime } from './session-reload';
import type { ActiveSession, SessionRuntimePool } from './session-runtime-pool';

/** Commands that operate on a live session, transparently restoring it first. */
export class SessionOperations {
	readonly #catalog: SessionCatalogService;
	readonly #pool: SessionRuntimePool;
	readonly #repository: SessionRepository;
	readonly #projects: ProjectCatalog;

	constructor(
		catalog: SessionCatalogService,
		pool: SessionRuntimePool,
		repository: SessionRepository,
		projects: ProjectCatalog,
	) {
		this.#catalog = catalog;
		this.#pool = pool;
		this.#repository = repository;
		this.#projects = projects;
	}

	async #armCompaction(active: ActiveSession) {
		const policy = await this.#projects.compactionFor(active.manager.getCwd());
		active.session.configureCompaction?.(policy);
		active.compaction = policy;
		return policy;
	}

	async renameSession(sessionId: string, title: string) {
		const name = title.trim();
		if (!name) throw new Error('Session name cannot be empty');
		if (this.#pool.has(sessionId)) {
			this.#pool.session(sessionId).setSessionName?.(name);
		} else await this.#repository.rename(sessionId, name);
	}

	/**
	 * The thread compacts under its workspace's policy, read fresh on every
	 * prompt so a change made from any client applies to the next turn.
	 */
	async prompt(
		sessionId: string,
		text: string,
		attachments: AgentAttachment[] = [],
	) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		await this.#armCompaction(active);
		if (
			!active.session.sessionName ||
			active.session.sessionName === 'New session'
		) {
			await this.renameSession(sessionId, sessionTitle(text));
		}
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await active.session.prompt(prompt, { images: prepared.images });
		} else await active.session.prompt(prompt);
	}

	async compact(sessionId: string) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		const session = active.session;
		const policy = await this.#projects.compactionFor(active.manager.getCwd());
		active.compaction = policy;
		if (session.isStreaming) {
			throw new Error('Cannot compact while the agent is responding');
		}
		if (session.isCompacting) {
			throw new Error('Compaction is already in progress');
		}
		await compactRequested(session, policy);
	}

	applyCompactionPolicy(projectPath: string, policy: CompactionPolicy) {
		rearmWorkspace(this.#pool, projectPath, policy);
	}

	async reloadSession(sessionId: string) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		if (active.session.isStreaming) {
			throw new Error('Cannot reload while the agent is responding');
		}
		await reloadRuntime(active);
	}

	reloadAllSessions() {
		return reloadAllSessions(this.#pool);
	}

	resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		this.#pool.resolveExtensionUi(sessionId, runtimeId, uiRequestId, response);
	}

	async generateCommitMessage(sessionId: string, context: string) {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		if (!session.generateCommitMessage) {
			throw new Error(
				'Commit message generation is unavailable for this session',
			);
		}
		return session.generateCommitMessage(context);
	}

	async generateTitle(
		sessionId: string,
		text: string,
		model?: { provider: string; id: string },
	) {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		if (!session.generateTitle) {
			throw new Error('Title generation is unavailable for this session');
		}
		return session.generateTitle(text, model);
	}

	async getTree(sessionId: string): Promise<SessionTree> {
		await this.#catalog.resumeSession(sessionId);
		return sessionTree(this.#pool.active(sessionId).manager);
	}

	async branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot> {
		await this.#catalog.resumeSession(sessionId);
		const { session, manager } = this.#pool.active(sessionId);
		if (session.isStreaming) {
			throw new Error('Cannot change branch while the agent is responding');
		}
		if (entryId === null) {
			const firstUserEntry = manager
				.getEntries()
				.find(
					(entry) => entry.type === 'message' && entry.message.role === 'user',
				);
			if (firstUserEntry && manager.getLeafId() === firstUserEntry.id) {
				manager.resetLeaf();
				await session.reload?.();
			} else if (firstUserEntry) {
				await session.navigateTree(firstUserEntry.id);
			} else manager.resetLeaf();
		} else {
			const target = manager.getEntry(entryId);
			if (!target) throw new Error(`Unknown entry: ${entryId}`);
			if (
				target.type === 'message' &&
				target.message.role === 'user' &&
				manager.getLeafId() === target.id
			) {
				if (target.parentId) manager.branch(target.parentId);
				else manager.resetLeaf();
				await session.reload?.();
			} else {
				const result = await session.navigateTree(entryId);
				if (result.cancelled)
					return this.#repository.snapshotOf(manager, sessionId);
			}
		}
		return this.#repository.snapshotOf(manager, sessionId);
	}

	async labelEntry(
		sessionId: string,
		entryId: string,
		label?: string,
	): Promise<SessionTree> {
		await this.#catalog.resumeSession(sessionId);
		const { manager } = this.#pool.active(sessionId);
		if (!manager.getEntry(entryId)) {
			throw new Error(`Unknown entry: ${entryId}`);
		}
		manager.appendLabelChange(entryId, label?.trim() || undefined);
		return sessionTree(manager);
	}

	async steer(
		sessionId: string,
		text: string,
		attachments: AgentAttachment[] = [],
	) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await active.session.steer(prompt, prepared.images);
		} else await active.session.steer(prompt);
	}

	async readAttachment(sessionId: string, attachmentId: string) {
		await this.#catalog.resumeSession(sessionId);
		return readStoredAttachment(
			this.#pool.active(sessionId).manager,
			attachmentId,
		);
	}

	async revealAttachment(sessionId: string, attachmentId: string) {
		await this.#catalog.resumeSession(sessionId);
		await revealStoredAttachment(
			this.#pool.active(sessionId).manager,
			attachmentId,
		);
	}

	async abort(sessionId: string) {
		this.#pool.cancelConfirmations(sessionId);
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		active.extensionUi.cancelDialogs('abort');
		await active.session.abort();
	}

	async getCommands(sessionId: string): Promise<ComposerCommand[]> {
		await this.#catalog.ensureActive(sessionId);
		return this.#pool.session(sessionId).getCommands?.() ?? [];
	}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		if (!session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		return session.getModelCatalog();
	}

	async selectModel(sessionId: string, provider: string, modelId: string) {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		if (session.isStreaming) {
			throw new Error('Cannot change models while the agent is responding');
		}
		if (!session.selectModel || !session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		await session.selectModel(provider, modelId);
		return session.getModelCatalog();
	}

	async selectThinkingLevel(sessionId: string, level: string) {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		if (session.isStreaming) {
			throw new Error(
				'Cannot change thinking level while the agent is responding',
			);
		}
		if (!session.selectThinkingLevel || !session.getModelCatalog) {
			throw new Error(
				'Thinking-level selection is unavailable for this session',
			);
		}
		session.selectThinkingLevel(level);
		return session.getModelCatalog();
	}

	async deleteSession(sessionId: string) {
		this.#pool.cancelConfirmations(sessionId);
		// The pool flushes the journal tail via `session_shutdown` before
		// disposing, so the session is journaled before its file is archived.
		await this.#pool.remove(sessionId);
		await this.#repository.delete(sessionId);
	}
}
