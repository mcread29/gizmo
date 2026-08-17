import {
	parseAgentEvent,
	type AgentEvent,
	type SessionState,
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

export class AgentStore {
	connection = $state<'disconnected' | 'connecting' | 'connected'>(
		'disconnected',
	);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	model = $state<AgentModel>();
	messages = $state<ConversationMessage[]>([]);
	error = $state<string>();

	readonly #client: AgentClient;
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;

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
			this.sessionId = await this.#client.createSession();
			this.connection = 'connected';
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.connection = 'disconnected';
			this.#cleanupSubscriptions();
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
		this.error = undefined;
		try {
			await this.#client.prompt(this.sessionId, text.trim());
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
