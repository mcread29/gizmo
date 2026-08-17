import {
	parseAgentEvent,
	type AgentEvent,
	type AgentSessionSummary,
	type ConversationMessage,
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

export class AgentStore {
	connection = $state<'disconnected' | 'connecting' | 'connected'>(
		'disconnected',
	);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	model = $state<AgentModel>();
	activeTools = $state<string[]>([]);
	messages = $state<ConversationMessage[]>([]);
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
	#statusRequest?: Promise<void>;

	constructor(client: AgentClient) {
		this.#client = client;
	}

	async connect(): Promise<void> {
		if (this.connection !== 'disconnected') return;
		this.connection = 'connecting';
		this.error = undefined;
		this.#unsubscribe = this.#client.subscribe((input) => this.#receive(input));
		this.#unsubscribeDisconnect = this.#client.subscribeDisconnect((error) => {
			if (this.connection !== 'connected') return;
			this.connection = 'disconnected';
			this.error = error.message;
			this.#cleanupSubscriptions();
		});
		try {
			await this.#client.connect();
			this.connection = 'connected';
			this.sessionId = undefined;
			this.messages = [];
			await this.refreshProjects();
			const catalog = await this.#client.listSessions();
			this.sessions = catalog.sessions;
			const session =
				this.sessions.find(({ id }) => id === catalog.lastSessionId) ??
				this.sessions[0];
			if (session) await this.switchSession(session.id);
			else await this.newSession();
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.connection = 'disconnected';
			this.#cleanupSubscriptions();
		}
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

	async selectProject(projectPath: string): Promise<void> {
		if (
			this.sessionState === 'streaming' ||
			!this.projects.some((project) => project.path === projectPath)
		) {
			return;
		}
		if (this.selectedProjectPath === projectPath) return;
		this.selectedProjectPath = projectPath;
		this.projectStatus = undefined;
		await Promise.all([this.refreshProjectStatus(), this.newSession()]);
	}

	refreshProjectStatus(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) {
			return Promise.resolve();
		}
		if (this.#statusRequest) return this.#statusRequest;
		this.#statusRequest = this.#loadProjectStatus().finally(() => {
			this.#statusRequest = undefined;
		});
		return this.#statusRequest;
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

	async newSession(): Promise<void> {
		if (this.connection !== 'connected' || this.sessionState === 'streaming') {
			return;
		}
		const previousId = this.sessionId;
		const previousMessages = this.messages;
		this.sessionId = undefined;
		this.messages = [];
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
		} catch (error) {
			this.sessionId = previousId;
			this.messages = previousMessages;
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
		this.sessionId = sessionId;
		this.messages = [];
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
		} catch (error) {
			this.sessionId = previousId;
			this.messages = previousMessages;
			this.error = errorMessage(error);
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
			case 'error':
				this.error = event.message;
				this.sessionState = 'error';
				break;
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
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sessionTitle(prompt: string): string {
	return prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
}
