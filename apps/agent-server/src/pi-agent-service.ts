import type {
	AgentSessionEvent,
	SessionManager,
} from '@earendil-works/pi-coding-agent';
import {
	agentToolPolicy,
	protocolVersion,
	sessionTitle,
	type AgentAttachment,
	type AgentModelCatalog,
	type CompactionPolicy,
	type AgentEvent,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
} from '@unity-agent/protocol';
import { createUnityTools } from '@unity-agent/unity-tools';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from './pi-event-translator';
import {
	PiSessionRepository,
	type SessionRepository,
} from './session-repository';
import { sessionTree } from './session-transcript';
import { unitySystemPrompt } from './unity-system-prompt';
import { attachmentPrompt } from './attachment-message';
import {
	prepareAttachments,
	readStoredAttachment,
	revealStoredAttachment,
	type PiImage,
} from './attachment-storage';

export interface PiSessionLike {
	readonly sessionId: string;
	readonly sessionName?: string;
	readonly model?: {
		readonly provider: string;
		readonly id: string;
		readonly contextWindow?: number;
	};
	readonly thinkingLevel?: string;
	readonly isStreaming?: boolean;
	getActiveToolNames?(): string[];
	getModelCatalog?(): Promise<AgentModelCatalog>;
	selectModel?(provider: string, modelId: string): Promise<void>;
	selectThinkingLevel?(level: string): void;
	configureCompaction?(policy: CompactionPolicy): void;
	compact?(): Promise<unknown>;
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	prompt(text: string, options?: { images?: PiImage[] }): Promise<void>;
	steer(text: string, images?: PiImage[]): Promise<void>;
	abort(): Promise<void>;
	setSessionName?(name: string): void;
	dispose(): void;
}

export type PiSessionFactory = (
	options: SessionOptions,
	sessionManager: SessionManager,
) => Promise<PiSessionLike>;
export type AgentEventListener = (event: AgentEvent) => void;

interface ActiveSession {
	session: PiSessionLike;
	/** Held so branching moves the leaf the live session reads from. */
	manager: SessionManager;
	unsubscribe: () => void;
}

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId' | 'sessionId'>
	: never;
type ServiceEvent = WithoutEventEnvelope<AgentEvent>;

export class PiAgentService {
	readonly #factory: PiSessionFactory;
	readonly #repository: SessionRepository;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #sessions = new Map<string, ActiveSession>();
	#eventId = 0;

	constructor(
		factory: PiSessionFactory = createDefaultPiSession,
		repository: SessionRepository = new PiSessionRepository(),
	) {
		this.#factory = factory;
		this.#repository = repository;
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		const cwd = options.cwd ?? process.cwd();
		const sessionManager = await this.#repository.create(cwd);
		try {
			const session = await this.#factory({ cwd }, sessionManager);
			this.#activate(session, sessionManager, 'New session');
			await this.#repository.setLastSession(session.sessionId);
			return session.sessionId;
		} catch (error) {
			await this.#repository.delete(sessionManager.getSessionId());
			throw error;
		}
	}

	listSessions(): Promise<SessionCatalog> {
		return this.#repository.list();
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const snapshot = await this.#repository.snapshot(sessionId);
		if (!this.#sessions.has(sessionId)) {
			const sessionManager = await this.#repository.open(sessionId);
			const session = await this.#factory(
				{ cwd: snapshot.session.projectPath },
				sessionManager,
			);
			this.#activate(session, sessionManager, snapshot.session.title);
		}
		await this.#repository.setLastSession(sessionId);
		return snapshot;
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		const name = title.trim();
		if (!name) throw new Error('Session name cannot be empty');
		const active = this.#sessions.get(sessionId);
		if (active?.session.setSessionName) active.session.setSessionName(name);
		else await this.#repository.rename(sessionId, name);
	}

	async prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		const active = this.#active(sessionId);
		const { session } = active;
		if (compaction) {
			validateCompactionPolicy(compaction);
			session.configureCompaction?.(compaction);
		}
		if (!session.sessionName || session.sessionName === 'New session') {
			await this.renameSession(sessionId, sessionTitle(text));
		}
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await session.prompt(prompt, { images: prepared.images });
		} else await session.prompt(prompt);
	}

	async compact(sessionId: string, policy: CompactionPolicy): Promise<void> {
		const session = this.#session(sessionId);
		validateCompactionPolicy(policy);
		if (session.isStreaming)
			throw new Error('Cannot compact while the agent is responding');
		if (!session.compact)
			throw new Error('Compaction is unavailable for this session');
		session.configureCompaction?.(policy);
		await session.compact();
	}

	#activate(
		session: PiSessionLike,
		manager: SessionManager,
		title: string,
	): void {
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.#emit(sessionId, this.#withContextWindow(session, event)),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, { session, manager, unsubscribe });
		this.#emit(sessionId, {
			type: 'session.created',
			title,
			...(session.getActiveToolNames
				? { tools: session.getActiveToolNames() }
				: {}),
			...(session.model
				? {
						model: {
							provider: session.model.provider,
							id: session.model.id,
							thinkingLevel: session.thinkingLevel ?? 'off',
						},
					}
				: {}),
		});
		this.#emit(sessionId, { type: 'session.state', state: 'idle' });
	}

	/**
	 * The session tree, including branches the current transcript does not walk.
	 * Resumes the session first so the tree reflects the live leaf.
	 */
	async getTree(sessionId: string): Promise<SessionTree> {
		await this.resumeSession(sessionId);
		return sessionTree(this.#active(sessionId).manager);
	}

	/**
	 * Moves the leaf so the next prompt continues from an earlier entry. A null
	 * entry rewinds past the first message, for re-running the opening prompt.
	 */
	async branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot> {
		await this.resumeSession(sessionId);
		const { session, manager } = this.#active(sessionId);
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
		await this.resumeSession(sessionId);
		const { manager } = this.#active(sessionId);
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
	): Promise<void> {
		const active = this.#active(sessionId);
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await active.session.steer(prompt, prepared.images);
		} else await active.session.steer(prompt);
	}

	async readAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<{ name: string; mimeType: string; data: string }> {
		await this.resumeSession(sessionId);
		return readStoredAttachment(this.#active(sessionId).manager, attachmentId);
	}

	async revealAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<void> {
		await this.resumeSession(sessionId);
		await revealStoredAttachment(this.#active(sessionId).manager, attachmentId);
	}

	abort(sessionId: string): Promise<void> {
		return this.#session(sessionId).abort();
	}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
		const session = this.#session(sessionId);
		if (!session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		return session.getModelCatalog();
	}

	async selectModel(
		sessionId: string,
		provider: string,
		modelId: string,
	): Promise<AgentModelCatalog> {
		const session = this.#session(sessionId);
		if (session.isStreaming) {
			throw new Error('Cannot change models while the agent is responding');
		}
		if (!session.selectModel || !session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		await session.selectModel(provider, modelId);
		return session.getModelCatalog();
	}

	async selectThinkingLevel(
		sessionId: string,
		level: string,
	): Promise<AgentModelCatalog> {
		const session = this.#session(sessionId);
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

	async deleteSession(sessionId: string): Promise<void> {
		const active = this.#sessions.get(sessionId);
		if (active) {
			active.unsubscribe();
			active.session.dispose();
			this.#sessions.delete(sessionId);
		}
		await this.#repository.delete(sessionId);
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	dispose(): void {
		for (const { session, unsubscribe } of this.#sessions.values()) {
			unsubscribe();
			session.dispose();
		}
		this.#sessions.clear();
		this.#listeners.clear();
	}

	#session(sessionId: string): PiSessionLike {
		return this.#active(sessionId).session;
	}

	#active(sessionId: string): ActiveSession {
		const active = this.#sessions.get(sessionId);
		if (!active) throw new Error(`Unknown session: ${sessionId}`);
		return active;
	}

	/** Only the session knows the model, and only the model knows the limit. */
	#withContextWindow(
		session: PiSessionLike,
		event: TranslatedPiEvent,
	): TranslatedPiEvent {
		if (event.type !== 'session.usage' || !session.model?.contextWindow) {
			return event;
		}
		return {
			...event,
			usage: {
				...event.usage,
				contextWindow: session.model.contextWindow,
			},
		};
	}

	#emit(sessionId: string, event: ServiceEvent | TranslatedPiEvent): void {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
			sessionId,
		} as AgentEvent;
		for (const listener of this.#listeners) listener(envelope);
	}
}

const createDefaultPiSession: PiSessionFactory = async (
	options,
	sessionManager,
) => {
	const {
		createAgentSession,
		DefaultResourceLoader,
		getAgentDir,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	const cwd = options.cwd ?? process.cwd();
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		noExtensions: true,
		systemPromptOverride: () => unitySystemPrompt,
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd,
		customTools: createUnityTools({ projectPath: cwd }),
		tools: [...agentToolPolicy.tools],
		resourceLoader,
		sessionManager,
		settingsManager,
	});
	return Object.assign(session, {
		configureCompaction(policy: CompactionPolicy): void {
			const contextWindow = session.model?.contextWindow ?? 128_000;
			settingsManager.applyOverrides({
				compaction: {
					enabled: policy.enabled,
					reserveTokens: Math.round(
						contextWindow * (1 - policy.fillPercent / 100),
					),
					keepRecentTokens: Math.round(
						contextWindow * (policy.retainPercent / 100),
					),
					fullTurnBoundaries: true,
				},
			});
		},
		async getModelCatalog(): Promise<AgentModelCatalog> {
			const models = await session.modelRuntime.getAvailable();
			return {
				...(session.model
					? {
							current: {
								provider: session.model.provider,
								id: session.model.id,
								thinkingLevel: session.thinkingLevel,
							},
						}
					: {}),
				models: models
					.map((model) => ({
						provider: model.provider,
						id: model.id,
						name: model.name,
						reasoning: model.reasoning,
					}))
					.sort((left, right) =>
						`${left.provider}/${left.name}`.localeCompare(
							`${right.provider}/${right.name}`,
						),
					),
				thinkingLevels: session.getAvailableThinkingLevels(),
			};
		},
		async selectModel(provider: string, modelId: string): Promise<void> {
			const model = session.modelRuntime.getModel(provider, modelId);
			if (!model) throw new Error(`Unknown model: ${provider}/${modelId}`);
			await session.setModel(model);
		},
		selectThinkingLevel(level: string): void {
			const available = session.getAvailableThinkingLevels();
			if (!available.includes(level as (typeof available)[number])) {
				throw new Error(`Unsupported thinking level: ${level}`);
			}
			session.setThinkingLevel(
				level as Parameters<typeof session.setThinkingLevel>[0],
			);
		},
	});
};

function validateCompactionPolicy(policy: CompactionPolicy): void {
	if (policy.retainPercent >= policy.fillPercent) {
		throw new Error('Retained context must be below the compaction threshold');
	}
}
