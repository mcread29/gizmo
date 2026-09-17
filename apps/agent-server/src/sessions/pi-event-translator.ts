import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { normalizeToolResult, toolResultIsError } from '../tools/tool-result';
import { displayedUserMessage } from '../attachments/attachment-message';
import { isStoppedTurn } from './transcript-settling';
import {
	getToolResultText,
	isRedactedThinking,
	readCompactionResult,
	readUsage,
	type TranslatedUsage,
} from './pi-event-helpers';

export { readUsage } from './pi-event-helpers';

export type TranslatedPiEvent =
	| {
			type: 'session.state';
			state: 'idle' | 'streaming' | 'error';
	  }
	| {
			type: 'session.compaction';
			active: boolean;
			reason: 'manual' | 'threshold' | 'overflow';
			result?: { tokensBefore: number; summary: string };
	  }
	| { type: 'session.queue'; steering: string[]; followUp: string[] }
	| {
			type: 'message.started';
			messageId: string;
			role: 'user' | 'assistant';
			createdAt: number;
			attachments?: ReturnType<typeof displayedUserMessage>['attachments'];
	  }
	| { type: 'message.delta'; messageId: string; delta: string }
	| {
			type: 'message.reasoning';
			messageId: string;
			delta: string;
			redacted?: boolean;
	  }
	| { type: 'message.completed'; messageId: string }
	| { type: 'session.usage'; usage: TranslatedUsage }
	| {
			type: 'tool.started';
			messageId: string;
			toolCallId: string;
			toolName: string;
			input: unknown;
	  }
	| {
			type: 'tool.updated';
			toolCallId: string;
			message: string;
			result?: unknown;
	  }
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
	/** Whether the current assistant message has already emitted reasoning. */
	#reasoningOpen = false;
	/**
	 * Pi reports a compaction Gizmo forced after a run as "manual"; the reason
	 * the user sees should be the threshold that actually caused it.
	 */
	#compactionReasonOverride?: 'threshold';

	constructor(emit: Emit) {
		this.#emit = emit;
	}

	/** In-flight assistant id for clients splicing a mid-stream subscription. */
	get activeAssistantMessageId(): string | undefined {
		return this.#activeMessageIds.get('assistant');
	}

	/** Reports the next compaction as threshold-driven rather than manual. */
	expectThresholdCompaction(): void {
		this.#compactionReasonOverride = 'threshold';
	}

	receive(event: AgentSessionEvent): void {
		switch (event.type) {
			case 'compaction_start':
				this.#emit({
					type: 'session.compaction',
					active: true,
					reason: this.#compactionReasonOverride ?? event.reason,
				});
				break;
			case 'compaction_end': {
				const result = readCompactionResult(event.result);
				this.#emit({
					type: 'session.compaction',
					active: false,
					reason: this.#compactionReasonOverride ?? event.reason,
					...(result ? { result } : {}),
				});
				this.#compactionReasonOverride = undefined;
				if (event.errorMessage) {
					this.#emit({
						type: 'error',
						code: 'compaction_failed',
						message: event.errorMessage,
					});
				}
				break;
			}
			case 'queue_update':
				this.#emit({
					type: 'session.queue',
					steering: [...event.steering],
					followUp: [...event.followUp],
				});
				break;
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
					if (event.message.role === 'assistant') {
						this.#lastAssistantMessageId = messageId;
						this.#reasoningOpen = false;
					}
					const displayed =
						event.message.role === 'user'
							? displayedUserMessage(event.message.content)
							: undefined;
					this.#emit({
						type: 'message.started',
						messageId,
						role: event.message.role,
						createdAt: event.message.timestamp,
						...(displayed?.attachments.length
							? { attachments: displayed.attachments }
							: {}),
					});
					if (event.message.role === 'user') {
						const text = displayed?.text ?? '';
						if (text)
							this.#emit({ type: 'message.delta', messageId, delta: text });
					}
				}
				break;
			case 'message_update': {
				const messageId = this.#activeMessageIds.get('assistant');
				const update = event.assistantMessageEvent;
				if (!messageId) break;
				if (update.type === 'text_delta') {
					this.#emit({ type: 'message.delta', messageId, delta: update.delta });
				} else if (update.type === 'thinking_delta') {
					// Some models open a thinking block with only a newline and then
					// say nothing; forwarding it would render a heading over nothing.
					if (!this.#reasoningOpen && !update.delta.trim()) break;
					this.#emit({
						type: 'message.reasoning',
						messageId,
						delta: update.delta,
					});
					this.#reasoningOpen = true;
				} else if (update.type === 'thinking_start' && this.#reasoningOpen) {
					// Consecutive thinking blocks read as separate paragraphs.
					this.#emit({ type: 'message.reasoning', messageId, delta: '\n\n' });
				} else if (
					update.type === 'thinking_end' &&
					isRedactedThinking(update.partial, update.contentIndex)
				) {
					// Nothing readable to show, but the model did think: say so
					// rather than rendering an empty block that looks like a bug.
					this.#emit({
						type: 'message.reasoning',
						messageId,
						delta: '',
						redacted: true,
					});
				}
				break;
			}
			case 'message_end':
				if (
					event.message.role === 'user' ||
					event.message.role === 'assistant'
				) {
					const messageId = this.#activeMessageIds.get(event.message.role);
					const interrupted = isStoppedTurn(event.message);
					if (messageId) {
						this.#emit({
							type: 'message.completed',
							messageId,
							...(interrupted ? { interrupted: true } : {}),
						});
					}
					this.#activeMessageIds.delete(event.message.role);
					if (event.message.role === 'assistant') {
						const usage = readUsage(event.message.usage);
						if (usage) this.#emit({ type: 'session.usage', usage });
					}
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
					...(event.partialResult &&
					typeof event.partialResult === 'object' &&
					'details' in event.partialResult &&
					event.partialResult.details !== undefined
						? { result: normalizeToolResult(event.partialResult) }
						: {}),
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
