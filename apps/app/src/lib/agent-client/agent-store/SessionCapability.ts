import { parseAgentEvent, type AgentEvent } from '@gizmo/protocol';
import { applyAgentEvent, emptyQueue } from '../agent-event-reducer';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import type { SessionSelection } from './session-selection';
import { EventReplay } from './event-replay';
import type { ProjectCapability } from './ProjectCapability';
import type { SessionSyncCapability } from './SessionSyncCapability';
import { SessionNaming } from './session-naming';
import { errorMessage } from './shared';

export class SessionCapability {
	#selectionVersion = 0;
	/** Live events held while a snapshot is read; shared with resync. */
	readonly replay = new EventReplay();
	/** Tells the sync capability about every event id this connection sees. */
	sync?: SessionSyncCapability;
	readonly #naming: SessionNaming;

	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
		private readonly projects: ProjectCapability,
		private readonly allowUnscopedSessions: boolean,
	) {
		this.#naming = new SessionNaming(store, client);
	}

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
		store.queue = emptyQueue();
		store.model = undefined;
		store.availableModels = [];
		store.thinkingLevels = [];
		store.commands = [];
		store.sessionState = 'idle';
		store.usage = undefined;
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
			Object.assign(this.store, previous);
			store.error = { kind: 'session', message: errorMessage(error) };
		}
	}

	async switchSession(sessionId: string) {
		const store = this.store;
		// A workspace screen moves the workspace out from under the open thread
		// and discards its transcript; returning re-derives neither, since the
		// thread never changed. Rebind, or fall through to load it back.
		if (sessionId === store.sessionId && store.messages.length)
			return this.rebindSelection();
		const selectionVersion = ++this.#selectionVersion;
		const session = store.sessions.find(({ id }) => id === sessionId);
		if (!session) return;
		const previous = this.#captureSelection();
		store.sessionId = sessionId;
		store.messages = [];
		store.unsent = [];
		store.queue = emptyQueue();
		store.messagesLoading = true;
		store.sessionState = store.sessionStates[sessionId] ?? 'idle';
		store.compacting = store.compactingSessions[sessionId] ?? false;
		store.usage = undefined;
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
				Object.assign(this.store, previous);
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
		// Nothing else re-reads which workspace the open thread belongs to.
		this.projects.adoptSessionWorkspace();
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
		delete store.compactingSessions[sessionId];
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
			// A thread is named from its opening message once the first run is
			// over, so the name arrives with the reply rather than racing it.
			if (event.state === 'idle') this.#naming.maybeName(event.sessionId);
		} else if (event.type === 'session.compaction') {
			// Tracked for every thread: the flag for the selected one is derived
			// from this on switch, so another thread's compaction never leaks in.
			if (event.active) store.compactingSessions[event.sessionId] = true;
			else delete store.compactingSessions[event.sessionId];
		} else if (event.type === 'error') {
			store.sessionStates[event.sessionId] = 'error';
		} else if (event.type === 'confirmation.requested') {
			store.pendingConfirmations.push(event);
			return;
		} else if (
			event.type.startsWith('extension.ui.') ||
			event.type === 'extension.view.updated' ||
			event.type === 'extensions.ui.changed'
		)
			return; // View surfaces subscribe directly; keep these out of transcripts.
		else if (event.type === 'extensions.reloaded') {
			// Refresh contributions after the server reloads extensions.
			void store.reloadExtensions({ server: false });
			return;
		}
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
}
