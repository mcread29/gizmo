import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { SessionSnapshot } from '@gizmo/protocol';
import { PiEventTranslator, readUsage } from './pi-event-translator';
import { PiExtensionUiRuntime } from './pi-extension-ui-runtime';
import { inFlightAssistantView } from './session-transcript';
import { AgentEventHub } from './agent-event-hub';
import type {
	PiAgentServiceOptions,
	PiSessionCallbacks,
	PiSessionLike,
} from './pi-agent-types';

export interface ActiveSession {
	session: PiSessionLike;
	/** Held so branching moves the leaf read by the live session. */
	manager: SessionManager;
	unsubscribe: () => void;
	lastActiveAt: number;
	extensionUi: PiExtensionUiRuntime;
	/** Owns the streaming message ids referenced by live events. */
	translator: PiEventTranslator;
}

/** Owns resident Pi runtimes, their event subscriptions, and their lifetime. */
export class SessionRuntimePool {
	readonly #sessions = new Map<string, ActiveSession>();
	readonly #extensionUiRuntimes = new Map<string, PiExtensionUiRuntime>();
	readonly #confirmations = new Map<
		string,
		{ sessionId: string; resolve: (accepted: boolean) => void }
	>();
	#confirmationId = 0;
	readonly #maxActiveSessions: number;
	readonly #idleTimeoutMs: number;
	readonly #sweepTimer: NodeJS.Timeout;

	constructor(
		readonly events: AgentEventHub,
		options: PiAgentServiceOptions = {},
	) {
		this.#maxActiveSessions = options.maxActiveSessions ?? 24;
		this.#idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60_000;
		this.#sweepTimer = setInterval(
			() => this.#evictIdle(),
			options.sweepIntervalMs ?? 5 * 60_000,
		);
		this.#sweepTimer.unref?.();
	}

	has(sessionId: string) {
		return this.#sessions.has(sessionId);
	}

	active(sessionId: string) {
		const active = this.#sessions.get(sessionId);
		if (!active) throw new Error(`Unknown session: ${sessionId}`);
		return active;
	}

	session(sessionId: string) {
		return this.active(sessionId).session;
	}

	async ensureActive(sessionId: string, resume: () => Promise<unknown>) {
		if (this.#sessions.has(sessionId)) {
			this.touch(sessionId);
			return;
		}
		await resume();
	}

	touch(sessionId: string) {
		const active = this.#sessions.get(sessionId);
		if (active) active.lastActiveAt = Date.now();
	}

	callbacks(sessionId: string): PiSessionCallbacks {
		const extensionUi = new PiExtensionUiRuntime((event) =>
			this.events.emit(sessionId, event),
		);
		this.#extensionUiRuntimes.set(sessionId, extensionUi);
		return {
			extensionUi,
			confirmStopPlayMode: (projectPath) =>
				new Promise<boolean>((resolve) => {
					const confirmationId = `confirmation-${++this.#confirmationId}`;
					this.#confirmations.set(confirmationId, { sessionId, resolve });
					this.events.emit(sessionId, {
						type: 'confirmation.requested',
						confirmationId,
						kind: 'stop_play_mode_for_compile',
						projectPath,
					});
				}),
		};
	}

	activate(
		session: PiSessionLike,
		manager: SessionManager,
		title: string,
		extensionUi: PiExtensionUiRuntime,
	) {
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.events.emit(sessionId, withContextWindow(session, event)),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, {
			session,
			manager,
			unsubscribe,
			lastActiveAt: Date.now(),
			extensionUi,
			translator,
		});
		this.events.emit(sessionId, {
			type: 'session.created',
			title,
			...(session.domains ? { domains: [...session.domains] } : {}),
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
		this.events.emit(sessionId, { type: 'session.state', state: 'idle' });
		this.#emitUsageSnapshot(sessionId, session, manager);
		this.#evictIdle();
	}

	/** Reconciles a resident streaming runtime with a newly read snapshot. */
	attachSnapshot(sessionId: string, snapshot: SessionSnapshot) {
		this.touch(sessionId);
		this.#spliceInFlightMessage(sessionId, snapshot);
		const active = this.#sessions.get(sessionId);
		this.events.emit(sessionId, {
			type: 'session.state',
			state: active?.session.isStreaming ? 'streaming' : 'idle',
		});
		if (active) {
			this.#emitUsageSnapshot(sessionId, active.session, active.manager);
		}
	}

	resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: Parameters<PiExtensionUiRuntime['resolve']>[2],
	) {
		const extensionUi = this.#extensionUiRuntimes.get(sessionId);
		if (!extensionUi) throw new Error(`Unknown session: ${sessionId}`);
		extensionUi.resolve(runtimeId, uiRequestId, response);
	}

	resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	) {
		const pending = this.#confirmations.get(confirmationId);
		if (!pending || pending.sessionId !== sessionId) {
			throw new Error(`Unknown confirmation: ${confirmationId}`);
		}
		this.#confirmations.delete(confirmationId);
		pending.resolve(accepted);
	}

	cancelConfirmations(sessionId: string) {
		for (const [id, pending] of this.#confirmations) {
			if (pending.sessionId !== sessionId) continue;
			this.#confirmations.delete(id);
			pending.resolve(false);
		}
	}

	discardPendingRuntime(sessionId: string) {
		this.#extensionUiRuntimes.get(sessionId)?.clear();
		this.#extensionUiRuntimes.delete(sessionId);
	}

	remove(sessionId: string) {
		const active = this.#sessions.get(sessionId);
		if (active) this.#evict(sessionId, active);
	}

	async abortStreamingSessions() {
		const timeoutMs = 10_000;
		await Promise.all(
			[...this.#sessions.entries()]
				.filter(([, active]) => active.session.isStreaming)
				.map(async ([sessionId, active]) => {
					try {
						await Promise.race([
							active.session.abort(),
							new Promise((resolve) => setTimeout(resolve, timeoutMs)),
						]);
					} catch (error) {
						console.error(
							`Error aborting session ${sessionId} on disconnect:`,
							error,
						);
					}
				}),
		);
	}

	dispose() {
		clearInterval(this.#sweepTimer);
		for (const { resolve } of this.#confirmations.values()) resolve(false);
		this.#confirmations.clear();
		for (const [sessionId, active] of this.#sessions) {
			this.#evict(sessionId, active);
		}
		this.#extensionUiRuntimes.clear();
	}

	#spliceInFlightMessage(sessionId: string, snapshot: SessionSnapshot) {
		const active = this.#sessions.get(sessionId);
		if (!active?.session.isStreaming) return;
		const messageId = active.translator.activeAssistantMessageId;
		const last = active.session.messages?.at(-1);
		if (!messageId || !last || last.role !== 'assistant') return;
		snapshot.messages = [
			...snapshot.messages,
			inFlightAssistantView(
				{ role: 'assistant', content: last.content, timestamp: last.timestamp },
				messageId,
			),
		];
	}

	#emitUsageSnapshot(
		sessionId: string,
		session: PiSessionLike,
		manager: SessionManager,
	) {
		if (typeof manager.getBranch !== 'function') return;
		const branch = manager.getBranch();
		for (let i = branch.length - 1; i >= 0; i--) {
			const entry = branch[i];
			if (entry.type !== 'message' || entry.message.role !== 'assistant')
				continue;
			const usage = readUsage(entry.message.usage);
			if (!usage) continue;
			this.events.emit(
				sessionId,
				withContextWindow(session, { type: 'session.usage', usage }),
			);
			return;
		}
	}

	#evict(sessionId: string, active: ActiveSession) {
		active.extensionUi.clear();
		this.#extensionUiRuntimes.delete(sessionId);
		active.unsubscribe();
		active.session.dispose();
		this.#sessions.delete(sessionId);
	}

	#evictIdle(now = Date.now()) {
		for (const [id, active] of this.#sessions) {
			if (
				!active.session.isStreaming &&
				now - active.lastActiveAt > this.#idleTimeoutMs
			) {
				this.#evict(id, active);
			}
		}
		if (this.#sessions.size <= this.#maxActiveSessions) return;
		const candidates = [...this.#sessions.entries()]
			.filter(([, active]) => !active.session.isStreaming)
			.sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt);
		for (const [id, active] of candidates) {
			if (this.#sessions.size <= this.#maxActiveSessions) break;
			this.#evict(id, active);
		}
	}
}

function withContextWindow(
	session: PiSessionLike,
	event: Parameters<AgentEventHub['emit']>[1],
) {
	if (event.type !== 'session.usage' || !session.model?.contextWindow)
		return event;
	return {
		...event,
		usage: { ...event.usage, contextWindow: session.model.contextWindow },
	};
}
