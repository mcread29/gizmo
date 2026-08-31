import {
	sessionTitle,
	type AgentAttachment,
	type AgentModelCatalog,
} from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { attachmentPrompt, errorMessage } from './shared';

export class SessionRuntimeCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async refreshCommands() {
		const store = this.store;
		if (!store.sessionId || store.connection !== 'connected') return;
		const sessionId = store.sessionId;
		try {
			const commands = await this.client.listCommands(sessionId);
			if (store.sessionId === sessionId) store.commands = commands;
		} catch (error) {
			if (store.sessionId === sessionId) this.#fail('session', error);
		}
	}

	async refreshModelCatalog() {
		const store = this.store;
		if (!store.sessionId || store.connection !== 'connected') return;
		const sessionId = store.sessionId;
		store.modelLoading = true;
		try {
			const catalog = await this.client.getModelCatalog(sessionId);
			if (store.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			if (store.sessionId === sessionId) this.#fail('session', error);
		} finally {
			if (store.sessionId === sessionId) store.modelLoading = false;
		}
	}

	async selectModel(provider: string, modelId: string) {
		const store = this.store;
		if (
			!store.sessionId ||
			store.sessionState === 'streaming' ||
			store.modelLoading ||
			(store.model?.provider === provider && store.model.id === modelId)
		)
			return;
		await this.#selectCatalog((sessionId) =>
			this.client.selectModel(sessionId, provider, modelId),
		);
	}

	async selectThinkingLevel(level: string) {
		const store = this.store;
		if (
			!store.sessionId ||
			store.sessionState === 'streaming' ||
			store.modelLoading ||
			store.model?.thinkingLevel === level
		)
			return;
		await this.#selectCatalog((sessionId) =>
			this.client.selectThinkingLevel(sessionId, level),
		);
	}

	async prompt(text: string, attachments: AgentAttachment[] = []) {
		const store = this.store;
		if (!store.sessionId || (!text.trim() && attachments.length === 0)) return;
		const sessionId = store.sessionId;
		const prompt = text.trim() || attachmentPrompt(attachments.length);
		store.error = undefined;
		store.lastPrompt = prompt;
		const session = store.sessions.find(({ id }) => id === sessionId);
		if (session) {
			if (session.title === 'New session') session.title = sessionTitle(prompt);
			session.lastActiveAt = Date.now();
		}
		try {
			if (attachments.length) {
				await this.client.prompt(
					sessionId,
					prompt,
					store.compactionPolicy,
					attachments,
				);
			} else {
				await this.client.prompt(sessionId, prompt, store.compactionPolicy);
			}
		} catch (error) {
			store.sessionStates[sessionId] = 'error';
			if (store.sessionId === sessionId) this.#fail('prompt', error);
		}
	}

	async compact() {
		const store = this.store;
		if (
			!store.sessionId ||
			store.compacting ||
			store.sessionState === 'streaming'
		)
			return;
		store.error = undefined;
		store.compacting = true;
		try {
			await this.client.compact(store.sessionId, store.compactionPolicy);
			store.usage = undefined;
		} catch (error) {
			this.#fail('agent', error);
		} finally {
			store.compacting = false;
		}
	}

	async reloadRuntime() {
		const store = this.store;
		if (
			!store.sessionId ||
			store.runtimeReloading ||
			store.sessionState === 'streaming'
		)
			return false;
		store.error = undefined;
		store.runtimeReloading = true;
		try {
			await this.client.reloadSession(store.sessionId);
			await store.refreshCommands();
			return true;
		} catch (error) {
			this.#fail('agent', error);
			return false;
		} finally {
			store.runtimeReloading = false;
		}
	}

	async steer(text: string, attachments: AgentAttachment[] = []) {
		const store = this.store;
		if (!store.sessionId || (!text.trim() && attachments.length === 0)) return;
		store.error = undefined;
		try {
			const prompt = text.trim() || attachmentPrompt(attachments.length);
			if (attachments.length) {
				await this.client.steer(store.sessionId, prompt, attachments);
			} else await this.client.steer(store.sessionId, prompt);
		} catch (error) {
			this.#fail('prompt', error);
		}
	}

	async loadTree() {
		if (!this.store.sessionId) return undefined;
		try {
			return await this.client.getSessionTree(this.store.sessionId);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	async branchTo(entryId: string | null) {
		const store = this.store;
		if (!store.sessionId || store.sessionState === 'streaming') return false;
		try {
			const snapshot = await this.client.branchSession(
				store.sessionId,
				entryId,
			);
			store.messages = snapshot.messages;
			const session = store.sessions.find(
				({ id }) => id === snapshot.session.id,
			);
			if (session) session.messageCount = snapshot.session.messageCount;
			store.error = undefined;
			return true;
		} catch (error) {
			this.#fail('session', error);
			return false;
		}
	}

	async labelEntry(entryId: string, label?: string) {
		if (!this.store.sessionId) return undefined;
		try {
			return await this.client.labelEntry(this.store.sessionId, entryId, label);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	async abort() {
		if (this.store.sessionId) await this.client.abort(this.store.sessionId);
	}

	async resolveConfirmation(
		confirmation: AgentStore['pendingConfirmations'][number],
		accepted: boolean,
	) {
		this.store.pendingConfirmations = this.store.pendingConfirmations.filter(
			({ confirmationId }) => confirmationId !== confirmation.confirmationId,
		);
		try {
			await this.client.resolveConfirmation(
				confirmation.sessionId,
				confirmation.confirmationId,
				accepted,
			);
		} catch (error) {
			this.#fail('agent', error);
		}
	}

	isSessionStreaming(sessionId: string | undefined) {
		return Boolean(
			sessionId && this.store.sessionStates[sessionId] === 'streaming',
		);
	}

	async readAttachment(attachmentId: string) {
		if (!this.store.sessionId) throw new Error('No active session');
		return await this.client.readAttachment(this.store.sessionId, attachmentId);
	}

	async revealAttachment(attachmentId: string) {
		if (!this.store.sessionId) throw new Error('No active session');
		await this.client.revealAttachment(this.store.sessionId, attachmentId);
	}

	async #selectCatalog(
		request: (sessionId: string) => Promise<AgentModelCatalog>,
	) {
		const store = this.store;
		if (!store.sessionId) return;
		store.modelLoading = true;
		store.error = undefined;
		const sessionId = store.sessionId;
		try {
			const catalog = await request(sessionId);
			if (store.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			if (store.sessionId === sessionId) this.#fail('session', error);
		} finally {
			if (store.sessionId === sessionId) store.modelLoading = false;
		}
	}

	#applyModelCatalog(catalog: AgentModelCatalog) {
		this.store.availableModels = [...catalog.models];
		this.store.thinkingLevels = [...catalog.thinkingLevels];
		if (catalog.current) this.store.model = catalog.current;
	}

	#fail(kind: 'agent' | 'prompt' | 'session', error: unknown) {
		this.store.error = { kind, message: errorMessage(error) };
	}
}
