import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import {
	agentToolPolicy,
	protocolVersion,
	type AgentModelCatalog,
	type AgentEvent,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
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
import { unitySystemPrompt } from './unity-system-prompt';

export interface PiSessionLike {
	readonly sessionId: string;
	readonly sessionName?: string;
	readonly model?: { readonly provider: string; readonly id: string };
	readonly thinkingLevel?: string;
	readonly isStreaming?: boolean;
	getActiveToolNames?(): string[];
	getModelCatalog?(): Promise<AgentModelCatalog>;
	selectModel?(provider: string, modelId: string): Promise<void>;
	selectThinkingLevel?(level: string): void;
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	prompt(text: string): Promise<void>;
	steer(text: string): Promise<void>;
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
			this.#activate(session, 'New session');
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
			this.#activate(session, snapshot.session.title);
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

	async prompt(sessionId: string, text: string): Promise<void> {
		const session = this.#session(sessionId);
		if (!session.sessionName || session.sessionName === 'New session') {
			await this.renameSession(sessionId, sessionTitle(text));
		}
		await session.prompt(text);
	}

	#activate(session: PiSessionLike, title: string): void {
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.#emit(sessionId, event),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, { session, unsubscribe });
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

	steer(sessionId: string, text: string): Promise<void> {
		return this.#session(sessionId).steer(text);
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
		const active = this.#sessions.get(sessionId);
		if (!active) throw new Error(`Unknown session: ${sessionId}`);
		return active.session;
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

function sessionTitle(prompt: string): string {
	const title = prompt.trim();
	return title.length > 48 ? `${title.slice(0, 47)}…` : title;
}
