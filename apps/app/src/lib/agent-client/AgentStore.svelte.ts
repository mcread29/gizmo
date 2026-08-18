import {
	parseAgentEvent,
	type AgentAttachment,
	type AgentModelCatalog,
	type AgentModelOption,
	type AgentEvent,
	type AgentSessionSummary,
	type ConversationMessage,
	type CompactionPolicy,
	type SessionSnapshot,
	type SessionState,
	type SessionTree,
	type SessionUsage,
	type ToolCallView,
	type UnityConsoleEntry,
	type UnityProject,
	type UnityStatus,
} from '@unity-agent/protocol';
import type { AgentClient } from './AgentClient';

export interface AgentModel {
	provider: string;
	id: string;
	thinkingLevel: string;
}

export type AgentErrorKind =
	'connection' | 'prompt' | 'session' | 'project' | 'agent';

export interface AgentError {
	kind: AgentErrorKind;
	message: string;
}

/** How many console lines the live tail keeps before dropping the oldest. */
const consoleLimit = 500;

export type ConnectionState =
	'disconnected' | 'connecting' | 'reconnecting' | 'connected';

/** Backoff between automatic reconnects; the last entry repeats forever. */
const reconnectDelays = [500, 1_000, 2_000, 5_000, 10_000, 15_000];

export class AgentStore {
	compactionPolicy: CompactionPolicy = {
		enabled: true,
		fillPercent: 25,
		retainPercent: 10,
	};
	compacting = $state(false);
	connection = $state<ConnectionState>('disconnected');
	reconnectAttempt = $state(0);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	model = $state<AgentModel>();
	availableModels = $state<AgentModelOption[]>([]);
	thinkingLevels = $state<string[]>([]);
	modelLoading = $state(false);
	activeTools = $state<string[]>([]);
	messages = $state<ConversationMessage[]>([]);
	messagesLoading = $state(false);
	/** Most recently submitted text, recalled into an empty composer with Up. */
	lastPrompt = $state<string>();
	sessions = $state<AgentSessionSummary[]>([]);
	projects = $state<UnityProject[]>([]);
	selectedProjectPath = $state<string>();
	projectStatus = $state<UnityStatus>();
	projectsLoading = $state(false);
	projectOpening = $state(false);
	projectError = $state<string>();
	error = $state<AgentError>();
	consoleEntries = $state<UnityConsoleEntry[]>([]);
	consoleLoading = $state(false);
	usage = $state<SessionUsage>();

	readonly #client: AgentClient;
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;
	#statusRequest?: { projectPath: string; promise: Promise<void> };
	#reconnectTimer?: ReturnType<typeof setTimeout>;
	#autoReconnect = true;

	constructor(client: AgentClient) {
		this.#client = client;
	}

	async connect(): Promise<void> {
		if (this.connection === 'connecting' || this.connection === 'connected') {
			return;
		}
		this.#autoReconnect = true;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.connection = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
		this.error = undefined;
		this.#unsubscribe = this.#client.subscribe((input) => this.#receive(input));
		this.#unsubscribeDisconnect = this.#client.subscribeDisconnect((error) => {
			if (this.connection !== 'connected') return;
			this.connection = 'disconnected';
			this.error = { kind: 'connection', message: error.message };
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		});
		// Remembered so a reconnect lands the user back where they were rather
		// than on whichever thread the server happens to consider most recent.
		const resumeId = this.sessionId;
		try {
			await this.#client.connect();
			this.connection = 'connected';
			this.reconnectAttempt = 0;
			this.sessionId = undefined;
			this.messages = [];
			await this.refreshProjects();
			const catalog = await this.#client.listSessions();
			this.sessions = catalog.sessions;
			const session =
				this.sessions.find(({ id }) => id === resumeId) ??
				this.sessions.find(({ id }) => id === catalog.lastSessionId) ??
				this.sessions[0];
			if (session) await this.switchSession(session.id);
			else await this.newSession();
		} catch (error) {
			this.#fail('connection', error);
			this.sessionId = resumeId;
			this.connection = 'disconnected';
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		}
	}

	/** Points the client at a different agent server and reconnects. */
	async reconnectTo(url: string): Promise<void> {
		if (!this.#client.setEndpoint) return;
		await this.disconnect();
		this.#client.setEndpoint(url);
		await this.reconnectNow();
	}

	/** Abandons the backoff and reconnects immediately. */
	async reconnectNow(): Promise<void> {
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.reconnectAttempt = 0;
		if (this.connection === 'disconnected') await this.connect();
	}

	#scheduleReconnect(): void {
		if (!this.#autoReconnect || this.#reconnectTimer !== undefined) return;
		const delay =
			reconnectDelays[
				Math.min(this.reconnectAttempt, reconnectDelays.length - 1)
			]!;
		this.reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined;
			void this.connect();
		}, delay);
	}

	async refreshProjects(): Promise<void> {
		if (this.connection !== 'connected') return;
		this.projectsLoading = true;
		this.projectError = undefined;
		try {
			this.projects = await this.#client.listProjects();
			if (
				!this.selectedProjectPath ||
				!this.projects.some(
					(project) => project.path === this.selectedProjectPath,
				)
			) {
				this.selectedProjectPath = this.projects[0]?.path;
			}
			await this.refreshProjectStatus();
		} catch (error) {
			this.projectError = errorMessage(error);
		} finally {
			this.projectsLoading = false;
		}
	}

	refreshProjectStatus(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) {
			return Promise.resolve();
		}
		const projectPath = this.selectedProjectPath;
		if (this.#statusRequest?.projectPath === projectPath) {
			return this.#statusRequest.promise;
		}
		const promise = this.#loadProjectStatus().finally(() => {
			if (this.#statusRequest?.projectPath === projectPath) {
				this.#statusRequest = undefined;
			}
		});
		this.#statusRequest = { projectPath, promise };
		return promise;
	}

	async #loadProjectStatus(): Promise<void> {
		const projectPath = this.selectedProjectPath;
		if (!projectPath) return;
		try {
			const status = await this.#client.getProjectStatus(projectPath);
			if (this.selectedProjectPath === projectPath) {
				this.projectStatus = status;
				this.projectError = undefined;
			}
		} catch (error) {
			if (this.selectedProjectPath === projectPath) {
				this.projectError = errorMessage(error);
			}
		}
	}

	async openSelectedProject(): Promise<void> {
		if (!this.selectedProjectPath || this.projectOpening) return;
		this.projectOpening = true;
		this.projectError = undefined;
		try {
			await this.#client.openProject(this.selectedProjectPath);
			await this.refreshProjectStatus();
		} catch (error) {
			this.projectError = errorMessage(error);
		} finally {
			this.projectOpening = false;
		}
	}

	async newSession(projectPath?: string): Promise<void> {
		if (this.connection !== 'connected' || this.sessionState === 'streaming') {
			return;
		}
		if (
			projectPath &&
			!this.projects.some((project) => project.path === projectPath)
		) {
			return;
		}
		const previousProjectPath = this.selectedProjectPath;
		const previousProjectStatus = this.projectStatus;
		const previousId = this.sessionId;
		const previousMessages = this.messages;
		const previousModel = this.model;
		const previousModels = this.availableModels;
		const previousThinkingLevels = this.thinkingLevels;
		if (projectPath) {
			this.selectedProjectPath = projectPath;
			this.projectStatus = undefined;
			await this.refreshProjectStatus();
		}
		this.sessionId = undefined;
		this.messages = [];
		this.model = undefined;
		this.availableModels = [];
		this.thinkingLevels = [];
		this.sessionState = 'idle';
		try {
			const sessionId = await this.#client.createSession({
				...(this.selectedProjectPath ? { cwd: this.selectedProjectPath } : {}),
			});
			this.sessionId = sessionId;
			const now = Date.now();
			this.sessions.unshift({
				id: sessionId,
				title: 'New session',
				...(this.selectedProjectPath
					? { projectPath: this.selectedProjectPath }
					: {}),
				createdAt: now,
				lastActiveAt: now,
				messageCount: 0,
			});
			await this.refreshModelCatalog();
			await this.#watchSelectedProject();
		} catch (error) {
			this.sessionId = previousId;
			this.messages = previousMessages;
			this.model = previousModel;
			this.availableModels = previousModels;
			this.thinkingLevels = previousThinkingLevels;
			this.selectedProjectPath = previousProjectPath;
			this.projectStatus = previousProjectStatus;
			this.#fail('session', error);
		}
	}

	async switchSession(sessionId: string): Promise<void> {
		if (this.sessionState === 'streaming' || sessionId === this.sessionId)
			return;
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		if (!session) return;
		const previousId = this.sessionId;
		const previousMessages = this.messages;
		const previousModel = this.model;
		const previousModels = this.availableModels;
		const previousThinkingLevels = this.thinkingLevels;
		const previousProjectPath = this.selectedProjectPath;
		const previousProjectStatus = this.projectStatus;
		this.sessionId = sessionId;
		this.messages = [];
		this.messagesLoading = true;
		this.sessionState = 'idle';
		this.usage = undefined;
		try {
			const snapshot = await this.#client.resumeSession(sessionId);
			this.messages = snapshot.messages;
			Object.assign(session, snapshot.session);
			if (session.projectPath !== this.selectedProjectPath) {
				this.selectedProjectPath = session.projectPath;
				this.projectStatus = undefined;
				await this.refreshProjectStatus();
			}
			await this.refreshModelCatalog();
			await this.#watchSelectedProject();
		} catch (error) {
			this.sessionId = previousId;
			this.messages = previousMessages;
			this.model = previousModel;
			this.availableModels = previousModels;
			this.thinkingLevels = previousThinkingLevels;
			this.selectedProjectPath = previousProjectPath;
			this.projectStatus = previousProjectStatus;
			this.#fail('session', error);
		} finally {
			if (this.sessionId === sessionId) this.messagesLoading = false;
		}
	}

	async readSession(sessionId: string): Promise<SessionSnapshot> {
		const activeSessionId = this.sessionId;
		try {
			return await this.#client.resumeSession(sessionId);
		} finally {
			if (activeSessionId && activeSessionId !== sessionId) {
				await this.#client.resumeSession(activeSessionId);
			}
		}
	}

	async refreshModelCatalog(): Promise<void> {
		if (!this.sessionId || this.connection !== 'connected') return;
		const sessionId = this.sessionId;
		this.modelLoading = true;
		try {
			const catalog = await this.#client.getModelCatalog(sessionId);
			if (this.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			if (this.sessionId === sessionId) this.#fail('session', error);
		} finally {
			if (this.sessionId === sessionId) this.modelLoading = false;
		}
	}

	async selectModel(provider: string, modelId: string): Promise<void> {
		if (
			!this.sessionId ||
			this.sessionState === 'streaming' ||
			this.modelLoading ||
			(this.model?.provider === provider && this.model.id === modelId)
		) {
			return;
		}
		this.modelLoading = true;
		this.error = undefined;
		const sessionId = this.sessionId;
		try {
			const catalog = await this.#client.selectModel(
				sessionId,
				provider,
				modelId,
			);
			if (this.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			this.#fail('session', error);
		} finally {
			this.modelLoading = false;
		}
	}

	async selectThinkingLevel(level: string): Promise<void> {
		if (
			!this.sessionId ||
			this.sessionState === 'streaming' ||
			this.modelLoading ||
			this.model?.thinkingLevel === level
		) {
			return;
		}
		this.modelLoading = true;
		this.error = undefined;
		const sessionId = this.sessionId;
		try {
			const catalog = await this.#client.selectThinkingLevel(sessionId, level);
			if (this.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			this.#fail('session', error);
		} finally {
			this.modelLoading = false;
		}
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		const name = title.trim();
		if (!session || !name) return;
		const previousTitle = session.title;
		session.title = name;
		try {
			await this.#client.renameSession(sessionId, name);
		} catch (error) {
			session.title = previousTitle;
			this.#fail('session', error);
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		if (
			this.sessionState === 'streaming' ||
			!this.sessions.some((session) => session.id === sessionId)
		) {
			return;
		}
		try {
			await this.#client.deleteSession(sessionId);
		} catch (error) {
			this.#fail('session', error);
			return;
		}
		this.sessions = this.sessions.filter((session) => session.id !== sessionId);
		if (this.sessionId !== sessionId) return;
		const next = this.sessions[0];
		if (next) await this.switchSession(next.id);
		else {
			this.sessionId = undefined;
			this.messages = [];
			await this.newSession();
		}
	}

	async disconnect(): Promise<void> {
		this.#autoReconnect = false;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.reconnectAttempt = 0;
		this.#cleanupSubscriptions();
		await this.#client.disconnect();
		this.connection = 'disconnected';
	}

	#cleanupSubscriptions(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		this.#unsubscribeDisconnect?.();
		this.#unsubscribeDisconnect = undefined;
	}

	async prompt(
		text: string,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		if (!this.sessionId || (!text.trim() && attachments.length === 0)) return;
		const prompt = text.trim() || attachmentPrompt(attachments.length);
		this.error = undefined;
		this.lastPrompt = prompt;
		const session = this.sessions.find(
			(candidate) => candidate.id === this.sessionId,
		);
		if (session) {
			if (session.title === 'New session') session.title = sessionTitle(prompt);
			session.lastActiveAt = Date.now();
		}
		try {
			if (attachments.length) {
				await this.#client.prompt(
					this.sessionId,
					prompt,
					this.compactionPolicy,
					attachments,
				);
			} else {
				await this.#client.prompt(
					this.sessionId,
					prompt,
					this.compactionPolicy,
				);
			}
		} catch (error) {
			this.#fail('prompt', error);
		}
	}

	async compact(): Promise<void> {
		if (!this.sessionId || this.compacting || this.sessionState === 'streaming')
			return;
		this.error = undefined;
		this.compacting = true;
		try {
			await this.#client.compact(this.sessionId, this.compactionPolicy);
			this.usage = undefined;
		} catch (error) {
			this.#fail('agent', error);
		} finally {
			this.compacting = false;
		}
	}

	/**
	 * Adds direction to the run already in flight. Unlike a prompt this does not
	 * wait for the agent to finish, which is the entire point of it.
	 */
	async steer(
		text: string,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		if (!this.sessionId || (!text.trim() && attachments.length === 0)) return;
		this.error = undefined;
		try {
			const prompt = text.trim() || attachmentPrompt(attachments.length);
			if (attachments.length) {
				await this.#client.steer(this.sessionId, prompt, attachments);
			} else await this.#client.steer(this.sessionId, prompt);
		} catch (error) {
			this.#fail('prompt', error);
		}
	}

	async revertFile(file: string, patch: string): Promise<void> {
		if (!this.selectedProjectPath) {
			throw new Error('No Unity project is selected');
		}
		await this.#client.revertFile(this.selectedProjectPath, file, patch);
	}

	/** Clears the local tail only; the Editor console is untouched. */
	clearConsole(): void {
		this.consoleEntries = [];
	}

	async loadConsole(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) return;
		this.consoleLoading = true;
		try {
			const update = await this.#client.readConsole(this.selectedProjectPath);
			this.consoleEntries = update.entries.slice(-consoleLimit);
		} catch (error) {
			this.#fail('project', error);
		} finally {
			this.consoleLoading = false;
		}
	}

	/** The session as a tree, including branches this transcript does not walk. */
	async loadTree(): Promise<SessionTree | undefined> {
		if (!this.sessionId) return undefined;
		try {
			return await this.#client.getSessionTree(this.sessionId);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	/**
	 * Moves the thread back to an earlier entry. Nothing is deleted: the
	 * abandoned replies stay in the tree and can be returned to.
	 */
	async branchTo(entryId: string | null): Promise<boolean> {
		if (!this.sessionId || this.sessionState === 'streaming') return false;
		try {
			const snapshot = await this.#client.branchSession(
				this.sessionId,
				entryId,
			);
			this.messages = snapshot.messages;
			const session = this.sessions.find(
				(candidate) => candidate.id === snapshot.session.id,
			);
			if (session) session.messageCount = snapshot.session.messageCount;
			this.error = undefined;
			return true;
		} catch (error) {
			this.#fail('session', error);
			return false;
		}
	}

	async labelEntry(
		entryId: string,
		label?: string,
	): Promise<SessionTree | undefined> {
		if (!this.sessionId) return undefined;
		try {
			return await this.#client.labelEntry(this.sessionId, entryId, label);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	async abort(): Promise<void> {
		if (this.sessionId) await this.#client.abort(this.sessionId);
	}

	async readAttachment(attachmentId: string) {
		if (!this.sessionId) throw new Error('No active session');
		return await this.#client.readAttachment(this.sessionId, attachmentId);
	}

	async revealAttachment(attachmentId: string): Promise<void> {
		if (!this.sessionId) throw new Error('No active session');
		await this.#client.revealAttachment(this.sessionId, attachmentId);
	}

	#receive(input: unknown): void {
		let event: AgentEvent;
		try {
			event = parseAgentEvent(input);
		} catch (error) {
			this.#fail('agent', error);
			return;
		}

		if (this.sessionId && event.sessionId !== this.sessionId) return;

		switch (event.type) {
			case 'session.created':
				this.model = event.model;
				this.activeTools = event.tools ?? [];
				break;
			case 'session.state':
				this.sessionState = event.state;
				break;
			case 'session.compaction':
				this.compacting = event.active;
				if (!event.active) this.usage = undefined;
				break;
			case 'message.started':
				this.messages.push({
					id: event.messageId,
					role: event.role,
					content: '',
					createdAt: event.createdAt,
					complete: false,
					tools: [],
					...(event.attachments ? { attachments: event.attachments } : {}),
				});
				{
					const session = this.#currentSession();
					if (session) session.messageCount++;
				}
				break;
			case 'message.delta': {
				const message = this.#message(event.messageId);
				if (message) message.content += event.delta;
				break;
			}
			case 'session.usage':
				this.usage = event.usage;
				break;
			case 'message.reasoning': {
				const message = this.#message(event.messageId);
				if (message) {
					if (event.delta)
						message.reasoning = (message.reasoning ?? '') + event.delta;
					if (event.redacted) message.reasoningRedacted = true;
				}
				break;
			}
			case 'message.completed': {
				const message = this.#message(event.messageId);
				if (message) message.complete = true;
				break;
			}
			case 'tool.started':
				this.#message(event.messageId)?.tools.push({
					id: event.toolCallId,
					name: event.toolName,
					status: 'running',
					statusText: 'Starting',
					...(event.input === undefined ? {} : { input: event.input }),
				});
				break;
			case 'tool.updated': {
				const tool = this.#tool(event.toolCallId);
				if (tool) tool.statusText = event.message;
				break;
			}
			case 'tool.completed': {
				const tool = this.#tool(event.toolCallId);
				if (tool) {
					tool.status = event.isError ? 'error' : 'complete';
					tool.statusText = event.isError ? 'Failed' : 'Completed';
					tool.result = event.result;
				}
				break;
			}
			case 'project.console.appended':
				if (event.projectPath === this.selectedProjectPath) {
					this.consoleEntries = [
						...this.consoleEntries,
						...event.update.entries,
					].slice(-consoleLimit);
				}
				break;
			case 'project.status.changed':
				if (event.projectPath === this.selectedProjectPath) {
					this.projectStatus = event.status;
					this.projectError = undefined;
				}
				break;
			case 'error':
				this.error = { kind: 'agent', message: event.message };
				this.sessionState = 'error';
				break;
		}
	}

	async #watchSelectedProject(): Promise<void> {
		if (
			this.connection !== 'connected' ||
			!this.sessionId ||
			!this.selectedProjectPath
		) {
			return;
		}
		const sessionId = this.sessionId;
		const projectPath = this.selectedProjectPath;
		try {
			const status = await this.#client.watchProjectStatus(
				sessionId,
				projectPath,
			);
			if (
				this.sessionId === sessionId &&
				this.selectedProjectPath === projectPath
			) {
				this.projectStatus = status;
				this.projectError = undefined;
			}
		} catch (error) {
			if (
				this.sessionId === sessionId &&
				this.selectedProjectPath === projectPath
			) {
				this.projectError = errorMessage(error);
			}
		}
	}

	#fail(kind: AgentErrorKind, error: unknown): void {
		this.error = { kind, message: errorMessage(error) };
	}

	#message(messageId: string): ConversationMessage | undefined {
		return this.messages.find((message) => message.id === messageId);
	}

	#tool(toolCallId: string): ToolCallView | undefined {
		for (const message of this.messages) {
			const tool = message.tools.find(
				(candidate) => candidate.id === toolCallId,
			);
			if (tool) return tool;
		}
		return undefined;
	}

	#currentSession(): AgentSessionSummary | undefined {
		return this.sessions.find(({ id }) => id === this.sessionId);
	}

	#applyModelCatalog(catalog: AgentModelCatalog): void {
		this.availableModels = [...catalog.models];
		this.thinkingLevels = [...catalog.thinkingLevels];
		if (catalog.current) this.model = catalog.current;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sessionTitle(prompt: string): string {
	return prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
}

function attachmentPrompt(count: number): string {
	return `Please inspect the attached ${count === 1 ? 'file' : 'files'}.`;
}
