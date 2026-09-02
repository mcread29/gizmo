import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { normalizeToolResult, toolResultIsError } from '../tools/tool-result';
import { displayedUserMessage } from '../attachments/attachment-message';
import { isStoppedTurn } from './transcript-settling';

export type TranslatedPiEvent =
	| {
			type: 'session.state';
			state: 'idle' | 'streaming' | 'error';
	  }
	| {
			type: 'session.compaction';
			active: boolean;
			reason: 'manual' | 'threshold' | 'overflow';
	  }
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
	| {
			type: 'session.usage';
			usage: {
				input: number;
				output: number;
				cacheRead: number;
				cacheWrite: number;
				contextUsed: number;
				cost: number;
				/** Filled in by the service, which knows the model. */
				contextWindow?: number;
			};
	  }
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
	/** Whether the current assistant message has already emitted reasoning. */
	#reasoningOpen = false;

	constructor(emit: Emit) {
		this.#emit = emit;
	}

	/**
	 * The id the in-flight assistant message is streaming under, if any. A
	 * client that subscribes mid-stream needs this to splice the partial
	 * message into its view so later deltas land on the right message.
	 */
	get activeAssistantMessageId(): string | undefined {
		return this.#activeMessageIds.get('assistant');
	}

	receive(event: AgentSessionEvent): void {
		switch (event.type) {
			case 'compaction_start':
				this.#emit({
					type: 'session.compaction',
					active: true,
					reason: event.reason,
				});
				break;
			case 'compaction_end':
				this.#emit({
					type: 'session.compaction',
					active: false,
					reason: event.reason,
				});
				if (event.errorMessage) {
					this.#emit({
						type: 'error',
						code: 'compaction_failed',
						message: event.errorMessage,
					});
				}
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

/**
 * Context used is what the next request has to re-send: everything the model
 * read this turn plus what it wrote. Cached tokens still occupy the window, so
 * they count even though they are cheap.
 */
export function readUsage(value: unknown): TranslatedUsage | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const usage = value as Record<string, unknown>;
	const input = count(usage.input);
	const output = count(usage.output);
	const cacheRead = count(usage.cacheRead);
	const cacheWrite = count(usage.cacheWrite);
	const cost = usage.cost as { total?: unknown } | undefined;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		contextUsed: input + cacheRead + cacheWrite + output,
		cost: count(cost?.total),
	};
}

type TranslatedUsage = Extract<
	TranslatedPiEvent,
	{ type: 'session.usage' }
>['usage'];

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? Math.round(value)
		: 0;
}

function isRedactedThinking(partial: unknown, index: number): boolean {
	if (!partial || typeof partial !== 'object' || !('content' in partial))
		return false;
	const content = (partial as { content: unknown }).content;
	if (!Array.isArray(content)) return false;
	const block = content[index] as
		{ type?: string; redacted?: boolean } | undefined;
	return block?.type === 'thinking' && block.redacted === true;
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
