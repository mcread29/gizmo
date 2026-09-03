import {
	parseAgentEvent,
	type AgentEvent,
	type AgentModelOption,
	type ConversationMessage,
	type SessionState,
	type SessionUsage,
} from '@gizmo/protocol';
import { applyAgentEvent } from '../agent-event-reducer';
import type { AgentClient } from '../AgentClient';
import type { AgentModel, AgentStore } from '../AgentStore.svelte';
import { EventReplay } from './event-replay';
import type { ProjectCapability } from './ProjectCapability';
import type { SessionSyncCapability } from './SessionSyncCapability';
import { errorMessage } from './shared';

interface SessionSelection {
	sessionId?: string;
	sessionState: SessionState;
	messages: ConversationMessage[];
	messagesLoading: boolean;
	model?: AgentModel;
	availableModels: AgentModelOption[];
	thinkingLevels: string[];
	enabledExtensionIds: string[];
	selectedProjectPath?: string;
	projectStatuses: Record<string, unknown>;
	projectServiceErrors: Record<string, string>;
	usage?: SessionUsage;
}

export class SessionCapability {
	#selectionVersion = 0;
	/** Live events held while a snapshot is read; shared with resync. */
	readonly replay = new EventReplay();
	/** Tells the sync capability about every event id this connection sees. */
	sync?: SessionSyncCapability;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly projects: ProjectCapability,
		private readonly allowUnscopedSessions: boolean,
	) {}

	/** Bumps on every new/switch; a stale async step compares against it. */
	get selectionVersion() {
		return this.#selectionVersion;
	}

	async newSession(projectPath?: string) {
		const store = this.store;
		if (store.connection !== 'connected') return;
		const workspacePath = projectPath ?? store.selectedProjectPath;
		if (!workspacePath && !this.allowUnscopedSessions) return;
		const selectionVersion = ++this.#selectionVersion;
		const previous = this.#captureSelection();
		if (workspacePath !== store.selectedProjectPath) {
			store.selectedProjectPath = workspacePath;
			store.projectStatuses = {};
		}
		store.enabledExtensionIds = (
			store.projects.find(({ path }) => path === store.selectedProjectPath)
				?.integrations ?? []
		).map(({ id }) => id);
		store.sessionId = undefined;
		store.messages = [];
		store.unsent = [];
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
			// A newer selection already replaced this one; leave its state alone.
			if (this.#selectionVersion !== selectionVersion) return;
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
			if (this.#selectionVersion !== selectionVersion) return;
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
		store.unsent = [];
		store.messagesLoading = true;
		store.sessionState = store.sessionStates[sessionId] ?? 'idle';
		store.usage = undefined;
		store.lastAutomaticCompactionReason = undefined;
		this.replay.begin(sessionId);
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
			const enabledExtensionIds =
				session.integrations?.map(({ id }) => id) ??
				(session.domainId && session.domainId !== 'generic'
					? [session.domainId]
					: []);
			const movedWorkspace = Boolean(
				workspacePath && workspacePath !== store.selectedProjectPath,
			);
			if (workspacePath)
				this.projects.enterWorkspace(workspacePath, enabledExtensionIds);
			else store.enabledExtensionIds = enabledExtensionIds;
			store.messages = snapshot.messages;
			store.messagesLoading = false;
			if (snapshot.state) store.sessionStates[sessionId] = snapshot.state;
			this.replay.release(
				sessionId,
				(event) => this.applyEvent(event),
				snapshot.lastEventId,
			);
			store.sessionState = store.sessionStates[sessionId] ?? store.sessionState;
			if (movedWorkspace) void store.refreshGitStatus();
			await Promise.all([
				store.refreshModelCatalog(),
				store.refreshCommands(),
				this.projects.watchSelectedProject(),
			]);
		} catch (error) {
			this.replay.discard(sessionId);
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

	/** After a reconnect: the new server process knows none of these yet. */
	async rebindSelection() {
		await Promise.all([
			this.store.refreshModelCatalog(),
			this.store.refreshCommands(),
			this.projects.watchSelectedProject(),
		]);
	}

	readSession(sessionId: string) {
		return this.client.readSession(sessionId);
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
			store.unsent = [];
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
		this.sync?.noteEvent(event.eventId);
		const store = this.store;
		if (event.type === 'session.state') {
			store.sessionStates[event.sessionId] = event.state;
		} else if (event.type === 'error') {
			store.sessionStates[event.sessionId] = 'error';
		} else if (event.type === 'confirmation.requested') {
			store.pendingConfirmations.push(event);
			return;
		} else if (event.type.startsWith('extension.ui.')) return;
		if (this.replay.hold(event)) return;
		// Project events describe a workspace and carry whichever session
		// registered the watch; the reducer matches them on project path.
		const projectEvent = event.type.startsWith('project.');
		if (!projectEvent && store.sessionId && event.sessionId !== store.sessionId)
			return;
		this.applyEvent(event);
	}

	applyEvent(event: AgentEvent) {
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
			enabledExtensionIds: store.enabledExtensionIds,
			selectedProjectPath: store.selectedProjectPath,
			projectStatuses: store.projectStatuses,
			projectServiceErrors: store.projectServiceErrors,
			usage: store.usage,
		};
	}

	#restoreSelection(selection: SessionSelection) {
		Object.assign(this.store, selection);
	}
}
