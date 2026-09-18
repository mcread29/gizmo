import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

/**
 * Names a thread once, from the message that opened it.
 *
 * Until a thread is named it is called after its first message, truncated —
 * which for a pasted stack trace or a path is unreadable in the rail. A small
 * model can do better for a fraction of a cent, so the model is the user's
 * choice and the feature is off until they make one.
 */
export class SessionNaming {
	/** Threads already named, or being named, this session. */
	readonly #done = new Set<string>();

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	/**
	 * Called when a run ends. Only the first run of a thread names it: later
	 * ones would rewrite a title the user may have come to recognise, and may
	 * have set themselves.
	 */
	maybeName(sessionId: string): void {
		const model = parseModel(this.store.titleModel);
		if (!model || !this.client.generateSessionTitle) return;
		if (sessionId !== this.store.sessionId) return;
		if (this.#done.has(sessionId)) return;
		const opening = this.store.messages.find(
			(message) => message.role === 'user' && message.content.trim(),
		);
		const userMessages = this.store.messages.filter(
			(message) => message.role === 'user',
		);
		if (!opening || userMessages.length !== 1) return;
		this.#done.add(sessionId);
		void this.#name(sessionId, opening.content, model);
	}

	/** Forgets what has been named, for a client that reconnects elsewhere. */
	reset(): void {
		this.#done.clear();
	}

	async #name(
		sessionId: string,
		text: string,
		model: { provider: string; id: string },
	) {
		try {
			const title = await this.client.generateSessionTitle!(
				sessionId,
				text,
				model,
			);
			// The user renaming the thread mid-flight wins: their title is a
			// decision, this one is a guess.
			const current = this.store.sessions.find(({ id }) => id === sessionId);
			if (current && current.title !== title) {
				await this.store.renameSession(sessionId, title);
			}
		} catch {
			// A thread that could not be named keeps the name it has. The model
			// may be unreachable or misconfigured, and neither is worth an error
			// in front of a reply the user is reading.
		}
	}
}

/** `provider/id`, as stored in settings. Empty or malformed means "off". */
export function parseModel(
	value: string,
): { provider: string; id: string } | undefined {
	const separator = value.indexOf('/');
	if (separator <= 0) return undefined;
	const provider = value.slice(0, separator).trim();
	const id = value.slice(separator + 1).trim();
	return provider && id ? { provider, id } : undefined;
}
