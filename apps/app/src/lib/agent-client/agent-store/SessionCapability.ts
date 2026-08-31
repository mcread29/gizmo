import {
	parseAgentEvent,
	type AgentEvent,
	type AgentModelOption,
	type ConversationMessage,
	type ProjectStatus,
	type SessionState,
	type SessionUsage,
} from '@gizmo/protocol';
import { applyAgentEvent } from '../agent-event-reducer';
import type { AgentClient } from '../AgentClient';
import type { AgentModel, AgentStore } from '../AgentStore.svelte';
import type { ProjectCapability } from './ProjectCapability';
import { errorMessage } from './shared';

interface SessionSelection {
	sessionId?: string;
	sessionState: SessionState;
	messages: ConversationMessage[];
	messagesLoading: boolean;
	model?: AgentModel;
	availableModels: AgentModelOption[];
	thinkingLevels: string[];
	activeDomains: string[];
	selectedProjectPath?: string;
	projectStatus?: ProjectStatus;
	usage?: SessionUsage;
}

export class SessionCapability {
	#selectionVersion = 0;
	#replayBuffer?: { sessionId: string; events: AgentEvent[] };

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly projects: ProjectCapability,
		private readonly allowUnscopedSessions: boolean,
	) {}

	async newSession(projectPath?: string) {
		const store = this.store;
		if (store.connection !== 'connected') return;
		const workspacePath = projectPath ?? store.selectedProjectPath;
		if (!workspacePath && !this.allowUnscopedSessions) return;
		const previous = this.#captureSelection();
		if (workspacePath !== store.selectedProjectPath) {
			store.selectedProjectPath = workspacePath;
			store.projectStatus = undefined;
		}
		store.activeDomains = (
			store.projects.find(({ path }) => path === store.selectedProjectPath)
				?.integrations ?? []
		).map(({ id }) => id);
		store.sessionId = undefined;
		store.messages = [];
		store.model = undefined;
		store.availableModels = [];
		store.thinkingLevels = [];
		store.commands = [];
		store.sessionState = 'idle';
		store.usage = undefined;
		store.lastAutomaticCompactionReason = undefined;
		try {
			const sessionId = await this.client.createSession({
				...(store.selectedProjectPath
					? { cwd: store.selectedProjectPath }
					: {}),
			});
			store.sessionId = sessionId;
			store.sessionStates[sessionId] = 'idle';
			const now = Date.now();
			store.sessions.unshift({
				id: sessionId,
				title: 'New session',
				...(store.selectedProjectPath
					? { workspacePath: store.selectedProjectPath }
					: {}),
				integrations:
					store.projects.find(({ path }) => path === store.selectedProjectPath)
						?.integrations ?? [],
				createdAt: now,
				lastActiveAt: now,
				messageCount: 0,
			});
			await Promise.all([
				store.refreshModelCatalog(),
				store.refreshCommands(),
				this.projects.watchSelectedProject(),
			]);
		} catch (error) {
			this.#restoreSelection(previous);
			store.error = { kind: 'session', message: errorMessage(error) };
		}
	}

	async switchSession(sessionId: string) {
		const store = this.store;
		if (sessionId === store.sessionId) return;
		const selectionVersion = ++this.#selectionVersion;
		const session = store.sessions.find(({ id }) => id === sessionId);
		if (!session) return;
		const previous = this.#captureSelection();
		store.sessionId = sessionId;
		store.messages = [];
		store.messagesLoading = true;
		store.sessionState = store.sessionStates[sessionId] ?? 'idle';
		store.usage = undefined;
		store.lastAutomaticCompactionReason = undefined;
		this.#replayBuffer = { sessionId, events: [] };
		const summaryPath = session.workspacePath ?? session.projectPath;
		if (summaryPath && summaryPath !== store.selectedProjectPath) {
			this.projects.enterWorkspace(
				summaryPath,
				session.integrations?.map(({ id }) => id),
			);
			void store.refreshGitStatus();
		}
		try {
			const snapshot = await this.client.resumeSession(sessionId);
			if (
				store.sessionId !== sessionId ||
				this.#selectionVersion !== selectionVersion
			)
				return;
			Object.assign(session, snapshot.session);
			const workspacePath = session.workspacePath ?? session.projectPath;
			const domains =
				session.integrations?.map(({ id }) => id) ??
				(session.domainId && session.domainId !== 'generic'
					? [session.domainId]
					: []);
			const movedWorkspace = Boolean(
				workspacePath && workspacePath !== store.selectedProjectPath,
			);
			if (workspacePath) this.projects.enterWorkspace(workspacePath, domains);
			else store.activeDomains = domains;
			store.messages = snapshot.messages;
			store.messagesLoading = false;
			this.#replay(sessionId, snapshot.lastEventId);
			store.sessionState = store.sessionStates[sessionId] ?? store.sessionState;
			if (movedWorkspace) void store.refreshGitStatus();
			await Promise.all([
				store.refreshModelCatalog(),
				store.refreshCommands(),
				this.projects.watchSelectedProject(),
			]);
		} catch (error) {
			if (this.#replayBuffer?.sessionId === sessionId) {
				this.#replayBuffer = undefined;
			}
			if (
				store.sessionId === sessionId &&
				this.#selectionVersion === selectionVersion
			) {
				this.#restoreSelection(previous);
				store.error = { kind: 'session', message: errorMessage(error) };
			}
		} finally {
			if (
				store.sessionId === sessionId &&
				this.#selectionVersion === selectionVersion
			) {
				store.messagesLoading = false;
			}
		}
	}

	async readSession(sessionId: string) {
		const activeSessionId = this.store.sessionId;
		try {
			return await this.client.resumeSession(sessionId);
		} finally {
			if (activeSessionId && activeSessionId !== sessionId) {
				await this.client.resumeSession(activeSessionId);
			}
		}
	}

	async renameSession(sessionId: string, title: string) {
		const session = this.store.sessions.find(({ id }) => id === sessionId);
		const name = title.trim();
		if (!session || !name) return;
		const previousTitle = session.title;
		session.title = name;
		try {
			await this.client.renameSession(sessionId, name);
		} catch (error) {
			session.title = previousTitle;
			this.store.error = { kind: 'session', message: errorMessage(error) };
		}
	}

	async deleteSession(sessionId: string) {
		const store = this.store;
		if (
			store.isSessionStreaming(sessionId) ||
			!store.sessions.some((session) => session.id === sessionId)
		)
			return;
		try {
			await this.client.deleteSession(sessionId);
		} catch (error) {
			store.error = { kind: 'session', message: errorMessage(error) };
			return;
		}
		store.sessions = store.sessions.filter(({ id }) => id !== sessionId);
		delete store.sessionStates[sessionId];
		if (store.sessionId !== sessionId) return;
		const next = store.sessions[0];
		if (next) await store.switchSession(next.id);
		else {
			store.sessionId = undefined;
			store.messages = [];
			await store.newSession();
		}
	}

	receive(input: unknown) {
		let event: AgentEvent;
		try {
			event = parseAgentEvent(input);
		} catch (error) {
			this.store.error = { kind: 'agent', message: errorMessage(error) };
			return;
		}
		const store = this.store;
		if (event.type === 'session.state') {
			store.sessionStates[event.sessionId] = event.state;
		} else if (event.type === 'error') {
			store.sessionStates[event.sessionId] = 'error';
		} else if (event.type === 'confirmation.requested') {
			store.pendingConfirmations.push(event);
			return;
		} else if (event.type.startsWith('extension.ui.')) return;
		if (this.#replayBuffer?.sessionId === event.sessionId) {
			this.#replayBuffer.events.push(event);
			return;
		}
		if (store.sessionId && event.sessionId !== store.sessionId) return;
		this.#applyEvent(event);
	}

	#replay(sessionId: string, cutoff?: number) {
		if (this.#replayBuffer?.sessionId !== sessionId) return;
		const events = this.#replayBuffer.events;
		this.#replayBuffer = undefined;
		for (const event of events) {
			if (cutoff !== undefined && event.eventId <= cutoff) continue;
			this.#applyEvent(event);
		}
	}

	#applyEvent(event: AgentEvent) {
		const eventError = applyAgentEvent(this.store, event);
		if (eventError) this.store.error = { kind: 'agent', message: eventError };
	}

	#captureSelection(): SessionSelection {
		const store = this.store;
		return {
			sessionId: store.sessionId,
			sessionState: store.sessionState,
			messages: store.messages,
			messagesLoading: store.messagesLoading,
			model: store.model,
			availableModels: store.availableModels,
			thinkingLevels: store.thinkingLevels,
			activeDomains: store.activeDomains,
			selectedProjectPath: store.selectedProjectPath,
			projectStatus: store.projectStatus,
			usage: store.usage,
		};
	}

	#restoreSelection(selection: SessionSelection) {
		Object.assign(this.store, selection);
	}
}
