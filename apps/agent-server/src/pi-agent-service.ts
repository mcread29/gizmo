import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
	agentToolPolicy,
	protocolVersion,
	type AgentEvent,
	type SessionOptions,
} from '@unity-agent/protocol';
import { createUnityTools } from '@unity-agent/unity-tools';
import { basename } from 'node:path';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from './pi-event-translator';

export interface PiSessionLike {
	readonly sessionId: string;
	readonly model?: { readonly provider: string; readonly id: string };
	readonly thinkingLevel?: string;
	getActiveToolNames?(): string[];
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	prompt(text: string): Promise<void>;
	steer(text: string): Promise<void>;
	abort(): Promise<void>;
	dispose(): void;
}

export type PiSessionFactory = (
	options: SessionOptions,
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
	readonly #listeners = new Set<AgentEventListener>();
	readonly #sessions = new Map<string, ActiveSession>();
	#eventId = 0;

	constructor(factory: PiSessionFactory = createDefaultPiSession) {
		this.#factory = factory;
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		const session = await this.#factory(options);
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.#emit(sessionId, event),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, { session, unsubscribe });
		this.#emit(sessionId, {
			type: 'session.created',
			title: options.cwd ? basename(options.cwd) : 'New session',
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
		return sessionId;
	}

	prompt(sessionId: string, text: string): Promise<void> {
		return this.#session(sessionId).prompt(text);
	}

	steer(sessionId: string, text: string): Promise<void> {
		return this.#session(sessionId).steer(text);
	}

	abort(sessionId: string): Promise<void> {
		return this.#session(sessionId).abort();
	}

	deleteSession(sessionId: string): void {
		const active = this.#sessions.get(sessionId);
		if (!active) throw new Error(`Unknown session: ${sessionId}`);
		active.unsubscribe();
		active.session.dispose();
		this.#sessions.delete(sessionId);
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

const createDefaultPiSession: PiSessionFactory = async (options) => {
	const {
		createAgentSession,
		DefaultResourceLoader,
		getAgentDir,
		SessionManager,
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
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd,
		customTools: createUnityTools({ projectPath: cwd }),
		tools: [...agentToolPolicy.tools],
		resourceLoader,
		sessionManager: SessionManager.inMemory(cwd),
		settingsManager,
	});
	return session;
};
