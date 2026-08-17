import {
	parseAgentEvent,
	type AgentEvent,
	type SessionState,
	type UnityProject,
	type UnityStatus,
} from '@unity-agent/protocol';
import type { AgentClient } from './AgentClient';

export interface ToolCallView {
	id: string;
	name: string;
	status: 'running' | 'complete' | 'error';
	statusText: string;
	result?: unknown;
}

export interface ConversationMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: number;
	complete: boolean;
	tools: ToolCallView[];
}

export interface AgentModel {
	provider: string;
	id: string;
	thinkingLevel: string;
}

export interface AgentSessionSummary {
	id: string;
	title: string;
	projectPath?: string;
	createdAt: number;
	lastActiveAt: number;
}

export class AgentStore {
	connection = $state<'disconnected' | 'connecting' | 'connected'>(
		'disconnected',
	);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	model = $state<AgentModel>();
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
	readonly #messagesBySession = new Map<string, ConversationMessage[]>();

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
			await this.refreshProjects();
			await this.newSession();
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
			this.#messagesBySession.set(sessionId, this.messages);
			const now = Date.now();
			this.sessions.unshift({
				id: sessionId,
				title: 'New session',
				...(this.selectedProjectPath
					? { projectPath: this.selectedProjectPath }
					: {}),
				createdAt: now,
				lastActiveAt: now,
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
		this.sessionId = sessionId;
		this.messages = this.#messagesBySession.get(sessionId) ?? [];
		this.sessionState = 'idle';
		if (session.projectPath !== this.selectedProjectPath) {
			this.selectedProjectPath = session.projectPath;
			this.projectStatus = undefined;
			await this.refreshProjectStatus();
		}
	}

	renameSession(sessionId: string, title: string): void {
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		if (session && title.trim()) session.title = title.trim();
	}

	async deleteSession(sessionId: string): Promise<void> {
		if (
			this.sessionState === 'streaming' ||
			!this.#messagesBySession.has(sessionId)
		) {
			return;
		}
		try {
			await this.#client.deleteSession(sessionId);
		} catch (error) {
			this.error = errorMessage(error);
			return;
		}
		this.#messagesBySession.delete(sessionId);
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
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function sessionTitle(prompt: string): string {
	return prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
}
