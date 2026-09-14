import type { PiAgentServiceOptions } from './pi-agent-types';
import type { ActiveSession } from './session-runtime-pool';
import type { PiExtensionUiRuntime } from './pi-extension-ui-runtime';

/**
 * Evicts idle and over-cap sessions. Eviction is the session's real end:
 * it flushes extension shutdown handlers — the journal's tail — before
 * disposal, so it must run even though `AgentSession.dispose()` alone never
 * emits `session_shutdown`. Map entries are dropped before awaiting so a
 * concurrent sweep or re-activation cannot evict or hand out a dying runtime
 * twice.
 */
export class SessionEviction {
	readonly #sessions: Map<string, ActiveSession>;
	readonly #extensionUiRuntimes: Map<string, PiExtensionUiRuntime>;
	readonly #maxActiveSessions: number;
	readonly #idleTimeoutMs: number;
	readonly #sweepTimer: NodeJS.Timeout;

	constructor(
		sessions: Map<string, ActiveSession>,
		extensionUiRuntimes: Map<string, PiExtensionUiRuntime>,
		options: Pick<
			PiAgentServiceOptions,
			'maxActiveSessions' | 'idleTimeoutMs' | 'sweepIntervalMs'
		> = {},
	) {
		this.#sessions = sessions;
		this.#extensionUiRuntimes = extensionUiRuntimes;
		this.#maxActiveSessions = options.maxActiveSessions ?? 24;
		this.#idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60_000;
		this.#sweepTimer = setInterval(
			() => void this.sweep(),
			options.sweepIntervalMs ?? 5 * 60_000,
		);
		this.#sweepTimer.unref?.();
	}

	async remove(sessionId: string) {
		const active = this.#sessions.get(sessionId);
		if (active) await this.#evict(sessionId, active);
	}

	/** Evicts everything; used on shutdown, awaited so flushes finish. */
	async dispose() {
		clearInterval(this.#sweepTimer);
		await Promise.all(
			[...this.#sessions].map(([sessionId, active]) =>
				this.#evict(sessionId, active),
			),
		);
	}

	/** Runs the sweep: idle timeouts first, then least-recently-used past the cap. */
	async sweep(now = Date.now()) {
		for (const [id, active] of this.#sessions) {
			if (
				!active.session.isStreaming &&
				now - active.lastActiveAt > this.#idleTimeoutMs
			) {
				void this.#evict(id, active);
			}
		}
		if (this.#sessions.size <= this.#maxActiveSessions) return;
		const candidates = [...this.#sessions.entries()]
			.filter(([, active]) => !active.session.isStreaming)
			.sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt);
		for (const [id, active] of candidates) {
			if (this.#sessions.size <= this.#maxActiveSessions) break;
			void this.#evict(id, active);
		}
	}

	async #evict(sessionId: string, active: ActiveSession) {
		this.#sessions.delete(sessionId);
		this.#extensionUiRuntimes.delete(sessionId);
		active.extensionUi.clear();
		active.unsubscribe();
		try {
			await active.session.shutdown?.();
		} catch (error) {
			console.error(`Error flushing session ${sessionId} on eviction:`, error);
		} finally {
			active.session.dispose();
		}
	}
}
