import {
	parseAgentEvent,
	type AgentModelCatalog,
	type AgentModelOption,
	type AgentEvent,
	type AgentSessionSummary,
	type ConversationMessage,
	type SessionSnapshot,
	type SessionState,
	type ToolCallView,
	type UnityProject,
	type UnityStatus,
} from '@unity-agent/protocol';
import type { AgentClient } from './AgentClient';

export interface AgentModel {
	provider: string;
	id: string;
	thinkingLevel: string;
}

export type ConnectionState =
	'disconnected' | 'connecting' | 'reconnecting' | 'connected';

/** Backoff between automatic reconnects; the last entry repeats forever. */
const reconnectDelays = [500, 1_000, 2_000, 5_000, 10_000, 15_000];

export class AgentStore {
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
	lastPrompt = $state<string>();
	sessions = $state<AgentSessionSummary[]>([]);
	projects = $state<UnityProject[]>([]);
	selectedProjectPath = $state<string>();
	projectStatus = $state<UnityStatus>();
	projectsLoading = $state(false);
	projectOpening = $state(false);
	projectError = $state<string>();
	error = $state<string>();

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
			this.error = error.message;
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
			this.error = error instanceof Error ? error.message : String(error);
			this.sessionId = resumeId;
			this.connection = 'disconnected';
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		}
	}

	/** Abandons the backoff and tries immediately, for an explicit user retry. */
	async retryConnection(): Promise<void> {
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
			this.error = errorMessage(error);
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
			this.error = errorMessage(error);
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
			if (this.sessionId === sessionId) this.error = errorMessage(error);
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
			this.error = errorMessage(error);
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
			this.error = errorMessage(error);
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
			this.error = errorMessage(error);
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
			this.error = errorMessage(error);
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

	async prompt(text: string): Promise<void> {
		if (!this.sessionId || !text.trim()) return;
		const prompt = text.trim();
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
			await this.#client.prompt(this.sessionId, prompt);
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		}
	}

	/** Resends the last prompt, for when a send failed rather than answered. */
	async retryPrompt(): Promise<void> {
		if (!this.lastPrompt || this.sessionState === 'streaming') return;
		await this.prompt(this.lastPrompt);
	}

	async abort(): Promise<void> {
		if (this.sessionId) await this.#client.abort(this.sessionId);
	}

	#receive(input: unknown): void {
		let event: AgentEvent;
		try {
			event = parseAgentEvent(input);
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
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
			case 'message.started':
				this.messages.push({
					id: event.messageId,
					role: event.role,
					content: '',
					createdAt: event.createdAt,
					complete: false,
					tools: [],
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
			case 'project.status.changed':
				if (event.projectPath === this.selectedProjectPath) {
					this.projectStatus = event.status;
					this.projectError = undefined;
				}
				break;
			case 'error':
				this.error = event.message;
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
