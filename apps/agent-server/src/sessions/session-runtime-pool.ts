import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { CompactionPolicy, SessionSnapshot } from '@gizmo/protocol';
import { compactOverdueRun, compactionOverdue } from './compaction-fallback';
import { PiEventTranslator } from './pi-event-translator';
import { PiExtensionUiRuntime } from './pi-extension-ui-runtime';
import { strandedMessages } from './queue-recovery';
import { AgentEventHub } from './agent-event-hub';
import { ConfirmationRegistry } from './session-confirmations';
import { SessionEviction } from './session-eviction';
import {
	emitUsageSnapshot,
	spliceInFlightMessage,
	withContextWindow,
} from './session-snapshot';
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
	/** The policy the last prompt was sent under, for the post-run check. */
	compaction?: CompactionPolicy;
	/** Whether Pi compacted on its own during the run in flight. */
	compactedThisRun?: boolean;
}

/**
 * Owns resident Pi runtimes and their event subscriptions. Eviction,
 * confirmations, and snapshot reconciliation each live in their own module;
 * this class wires them around the session map.
 */
export class SessionRuntimePool {
	readonly #sessions = new Map<string, ActiveSession>();
	readonly #extensionUiRuntimes = new Map<string, PiExtensionUiRuntime>();
	readonly #confirmations = new ConfirmationRegistry();
	readonly #eviction: SessionEviction;

	constructor(
		readonly events: AgentEventHub,
		options: PiAgentServiceOptions = {},
	) {
		this.#eviction = new SessionEviction(
			this.#sessions,
			this.#extensionUiRuntimes,
			options,
		);
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
				this.#confirmations.create(sessionId, (confirmationId) =>
					this.events.emit(sessionId, {
						type: 'confirmation.requested',
						confirmationId,
						kind: 'stop_play_mode_for_compile',
						projectPath,
					}),
				),
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
		const active: ActiveSession = {
			session,
			manager,
			unsubscribe: () => {},
			lastActiveAt: Date.now(),
			extensionUi,
			translator,
		};
		active.unsubscribe = session.subscribe((event) => {
			translator.receive(event);
			if (event.type === 'agent_start') active.compactedThisRun = false;
			if (event.type === 'compaction_start') active.compactedThisRun = true;
			if (event.type !== 'agent_settled') return;
			const messages = strandedMessages(session);
			if (messages.length) {
				this.events.emit(sessionId, { type: 'session.unsent', messages });
			}
			void this.#compactIfOverdue(sessionId, active);
		});
		this.#sessions.set(sessionId, active);
		this.#emitSessionCreated(sessionId, session, title);
		this.events.emit(sessionId, { type: 'session.state', state: 'idle' });
		emitUsageSnapshot(this.events, sessionId, session, manager);
		void this.#eviction.sweep();
	}

	/** Reconciles a resident streaming runtime with a newly read snapshot. */
	attachSnapshot(sessionId: string, snapshot: SessionSnapshot) {
		this.touch(sessionId);
		const active = this.#sessions.get(sessionId);
		if (active?.session.isStreaming) {
			spliceInFlightMessage(
				snapshot,
				active.translator.activeAssistantMessageId,
				active.session.messages,
			);
		}
		this.events.emit(sessionId, {
			type: 'session.state',
			state: active?.session.isStreaming ? 'streaming' : 'idle',
		});
		if (active) {
			emitUsageSnapshot(this.events, sessionId, active.session, active.manager);
			// A client joining mid-run needs to see what is still queued.
			this.events.emit(sessionId, {
				type: 'session.queue',
				steering: [...(active.session.getSteeringMessages?.() ?? [])],
				followUp: [...(active.session.getFollowUpMessages?.() ?? [])],
			});
		}
	}

	async #compactIfOverdue(sessionId: string, active: ActiveSession) {
		if (
			active.compactedThisRun ||
			active.session.isStreaming ||
			!active.compaction ||
			!compactionOverdue(active.session, active.compaction)
		)
			return;
		active.compactedThisRun = true;
		active.translator.expectThresholdCompaction();
		await compactOverdueRun(active.session, active.compaction, (message) =>
			this.events.emit(sessionId, {
				type: 'error',
				code: 'compaction_failed',
				message,
			}),
		);
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
		this.#confirmations.resolve(sessionId, confirmationId, accepted);
	}

	cancelConfirmations(sessionId: string) {
		this.#confirmations.cancelAll(sessionId);
	}

	discardPendingRuntime(sessionId: string) {
		this.#extensionUiRuntimes.get(sessionId)?.clear();
		this.#extensionUiRuntimes.delete(sessionId);
	}

	async remove(sessionId: string) {
		return this.#eviction.remove(sessionId);
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

	async dispose() {
		await this.#eviction.dispose();
		this.#confirmations.dispose();
		this.#extensionUiRuntimes.clear();
	}

	#emitSessionCreated(
		sessionId: string,
		session: PiSessionLike,
		title: string,
	) {
		this.events.emit(sessionId, {
			type: 'session.created',
			title,
			// `domains` is the protocol-v25 wire name for enabled extension IDs.
			...(session.enabledExtensionIds
				? { domains: [...session.enabledExtensionIds] }
				: {}),
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
	}
}
