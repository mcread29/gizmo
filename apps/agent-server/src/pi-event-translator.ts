import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { normalizeToolResult, toolResultIsError } from './tool-result';

export type TranslatedPiEvent =
	| {
			type: 'session.state';
			state: 'idle' | 'streaming' | 'error';
	  }
	| {
			type: 'message.started';
			messageId: string;
			role: 'user' | 'assistant';
			createdAt: number;
	  }
	| { type: 'message.delta'; messageId: string; delta: string }
	| { type: 'message.completed'; messageId: string }
	| {
			type: 'tool.started';
			messageId: string;
			toolCallId: string;
			toolName: string;
			input: unknown;
	  }
	| { type: 'tool.updated'; toolCallId: string; message: string }
	| {
			type: 'tool.completed';
			toolCallId: string;
			result: unknown;
			isError: boolean;
	  }
	| { type: 'error'; code: string; message: string };

type Emit = (event: TranslatedPiEvent) => void;

export class PiEventTranslator {
	readonly #emit: Emit;
	#messageId = 0;
	#activeMessageIds = new Map<'user' | 'assistant', string>();
	#lastAssistantMessageId?: string;

	constructor(emit: Emit) {
		this.#emit = emit;
	}

	receive(event: AgentSessionEvent): void {
		switch (event.type) {
			case 'agent_start':
				this.#emit({ type: 'session.state', state: 'streaming' });
				break;
			case 'agent_settled':
				this.#emit({ type: 'session.state', state: 'idle' });
				break;
			case 'message_start':
				if (
					event.message.role === 'user' ||
					event.message.role === 'assistant'
				) {
					const messageId = `message-${++this.#messageId}`;
					this.#activeMessageIds.set(event.message.role, messageId);
					if (event.message.role === 'assistant')
						this.#lastAssistantMessageId = messageId;
					this.#emit({
						type: 'message.started',
						messageId,
						role: event.message.role,
						createdAt: event.message.timestamp,
					});
					if (event.message.role === 'user') {
						const text = getMessageText(event.message.content);
						if (text)
							this.#emit({ type: 'message.delta', messageId, delta: text });
					}
				}
				break;
			case 'message_update':
				if (event.assistantMessageEvent.type === 'text_delta') {
					const messageId = this.#activeMessageIds.get('assistant');
					if (messageId) {
						this.#emit({
							type: 'message.delta',
							messageId,
							delta: event.assistantMessageEvent.delta,
						});
					}
				}
				break;
			case 'message_end':
				if (
					event.message.role === 'user' ||
					event.message.role === 'assistant'
				) {
					const messageId = this.#activeMessageIds.get(event.message.role);
					if (messageId) this.#emit({ type: 'message.completed', messageId });
					this.#activeMessageIds.delete(event.message.role);
					if (
						event.message.role === 'assistant' &&
						event.message.errorMessage
					) {
						this.#emit({
							type: 'error',
							code: 'model_error',
							message: event.message.errorMessage,
						});
					}
				}
				break;
			case 'tool_execution_start':
				if (this.#lastAssistantMessageId) {
					this.#emit({
						type: 'tool.started',
						messageId: this.#lastAssistantMessageId,
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						input: event.args,
					});
				}
				break;
			case 'tool_execution_update':
				this.#emit({
					type: 'tool.updated',
					toolCallId: event.toolCallId,
					message: getToolResultText(event.partialResult) || 'Running',
				});
				break;
			case 'tool_execution_end':
				this.#emit({
					type: 'tool.completed',
					toolCallId: event.toolCallId,
					result: normalizeToolResult(event.result),
					isError: event.isError || toolResultIsError(event.result),
				});
				break;
		}
	}
}

function getMessageText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(
			(item): item is { type: 'text'; text: string } => item?.type === 'text',
		)
		.map((item) => item.text)
		.join('');
}

function getToolResultText(result: unknown): string {
	if (!result || typeof result !== 'object' || !('content' in result))
		return '';
	return getMessageText(result.content);
}
