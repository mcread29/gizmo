import type { AgentStore } from '../../agent-client';
import type { ToastQueue } from '../../toasts.svelte';
import {
	downloadTranscript,
	transcriptFileName,
	transcriptMarkdown,
} from './transcript';

/**
 * Thread-level commands and the dialog state they need. The same three actions
 * are reachable from the thread menu, the context menu, and the keyboard, so
 * they live here once instead of being re-implemented per surface.
 */
export class SessionActions {
	projectPickerOpen = $state(false);
	renameOpen = $state(false);
	deleteOpen = $state(false);
	renameDraft = $state('');
	targetId = $state<string>();

	readonly #store: AgentStore;
	readonly #agentName: string;
	readonly #toasts: ToastQueue;

	get targetTitle(): string {
		return (
			this.#store.sessions.find((session) => session.id === this.targetId)
				?.title ?? 'this thread'
		);
	}

	constructor(store: AgentStore, agentName: string, toasts: ToastQueue) {
		this.#store = store;
		this.#agentName = agentName;
		this.#toasts = toasts;
	}

	async startThread(projectPath: string): Promise<void> {
		this.projectPickerOpen = false;
		await this.#store.newSession(projectPath);
	}

	beginRename(sessionId = this.#store.sessionId): void {
		const session = this.#store.sessions.find(({ id }) => id === sessionId);
		if (!session) return;
		this.targetId = session.id;
		this.renameDraft = session.title;
		this.renameOpen = true;
	}

	async confirmRename(): Promise<void> {
		if (!this.targetId || !this.renameDraft.trim()) return;
		await this.#store.renameSession(this.targetId, this.renameDraft);
		this.renameOpen = false;
		this.targetId = undefined;
	}

	beginDelete(sessionId = this.#store.sessionId): void {
		if (!sessionId) return;
		this.targetId = sessionId;
		this.deleteOpen = true;
	}

	async confirmDelete(): Promise<void> {
		if (!this.targetId) return;
		const sessionId = this.targetId;
		const title = this.targetTitle;
		this.deleteOpen = false;
		this.targetId = undefined;
		await this.#store.deleteSession(sessionId);
		if (this.#store.error) this.#toasts.show(this.#store.error, 'danger');
		else this.#toasts.show(`Deleted “${title}”`);
	}

	async exportTranscript(sessionId = this.#store.sessionId): Promise<void> {
		if (!sessionId) return;
		try {
			const snapshot = await this.#snapshot(sessionId);
			const fileName = transcriptFileName(snapshot.session.title);
			downloadTranscript(
				transcriptMarkdown(snapshot, this.#agentName),
				fileName,
			);
			this.#toasts.show(`Exported ${fileName}`);
		} catch (error) {
			this.#toasts.show(
				error instanceof Error ? error.message : String(error),
				'danger',
			);
		}
	}

	async #snapshot(sessionId: string) {
		const store = this.#store;
		const current = store.sessions.find(({ id }) => id === store.sessionId);
		if (sessionId === store.sessionId && current) {
			return { session: current, messages: store.messages };
		}
		return store.readSession(sessionId);
	}
}
