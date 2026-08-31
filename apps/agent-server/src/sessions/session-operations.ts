import { sessionTitle } from '@gizmo/protocol';
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
import { sessionTree } from './session-transcript';
import type { SessionRepository } from './session-repository';
import type { SessionCatalogService } from './session-catalog-service';
import type { SessionRuntimePool } from './session-runtime-pool';

/** Commands that operate on a live session, transparently restoring it first. */
export class SessionOperations {
	readonly #catalog: SessionCatalogService;
	readonly #pool: SessionRuntimePool;
	readonly #repository: SessionRepository;

	constructor(
		catalog: SessionCatalogService,
		pool: SessionRuntimePool,
		repository: SessionRepository,
	) {
		this.#catalog = catalog;
		this.#pool = pool;
		this.#repository = repository;
	}

	async renameSession(sessionId: string, title: string) {
		const name = title.trim();
		if (!name) throw new Error('Session name cannot be empty');
		if (this.#pool.has(sessionId)) {
			this.#pool.session(sessionId).setSessionName?.(name);
		} else await this.#repository.rename(sessionId, name);
	}

	async prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments: AgentAttachment[] = [],
	) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		if (compaction) {
			validateCompactionPolicy(compaction);
			active.session.configureCompaction?.(compaction);
		}
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

	async compact(sessionId: string, policy: CompactionPolicy) {
		await this.#catalog.ensureActive(sessionId);
		const session = this.#pool.session(sessionId);
		validateCompactionPolicy(policy);
		if (session.isStreaming) {
			throw new Error('Cannot compact while the agent is responding');
		}
		if (!session.compact) {
			throw new Error('Compaction is unavailable for this session');
		}
		session.configureCompaction?.(policy);
		await session.compact();
	}

	async reloadSession(sessionId: string) {
		await this.#catalog.ensureActive(sessionId);
		const active = this.#pool.active(sessionId);
		if (active.session.isStreaming) {
			throw new Error('Cannot reload while the agent is responding');
		}
		if (!active.session.reload) {
			throw new Error('Runtime reload is unavailable for this session');
		}
		active.extensionUi.clear();
		await active.session.reload({
			beforeSessionStart: () => {
				active.extensionUi.clear();
				active.extensionUi.startNewRuntime();
			},
		});
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
		if (entryId === null) manager.resetLeaf();
		else if (!manager.getEntry(entryId)) {
			throw new Error(`Unknown entry: ${entryId}`);
		} else manager.branch(entryId);
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
		this.#pool.remove(sessionId);
		await this.#repository.delete(sessionId);
	}
}

function validateCompactionPolicy(policy: CompactionPolicy) {
	if (policy.retainPercent >= policy.fillPercent) {
		throw new Error('Retained context must be below the compaction threshold');
	}
}
