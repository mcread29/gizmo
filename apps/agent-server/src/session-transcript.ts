import type {
	SessionEntry,
	SessionManager,
	SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type {
	ConversationMessage,
	SessionTree,
	SessionTreeEntry,
	ToolCallView,
} from '@unity-agent/protocol';
import { displayedUserMessage } from './attachment-message';
import { normalizeToolResult, toolResultIsError } from './tool-result';

/** Includes every recorded entry, even branches outside the active transcript. */
export function sessionTree(manager: SessionManager): SessionTree {
	const entries: SessionTreeEntry[] = [];
	for (const entry of manager.getEntries()) {
		const view = treeEntry(entry, manager.getLabel(entry.id));
		if (view) entries.push(view);
	}
	return { entries, leafId: manager.getLeafId() };
}

export function sessionTranscript(
	manager: SessionManager,
): ConversationMessage[] {
	const messages: ConversationMessage[] = [];
	const tools = new Map<string, ToolCallView>();

	for (const entry of manager.getBranch()) {
		if (entry.type !== 'message') continue;
		const message = (entry as SessionMessageEntry).message;
		if (message.role === 'user') {
			const displayed = displayedUserMessage(message.content);
			messages.push({
				id: entry.id,
				role: 'user',
				content: displayed.text,
				...(displayed.attachments.length
					? { attachments: displayed.attachments }
					: {}),
				createdAt: message.timestamp,
				complete: true,
				tools: [],
			});
			continue;
		}
		if (message.role === 'assistant') {
			const messageTools = message.content
				.filter((content) => content.type === 'toolCall')
				.map((toolCall) => {
					const input = toolCallInput(toolCall);
					const tool: ToolCallView = {
						id: toolCall.id,
						name: toolCall.name,
						status: 'running',
						statusText: 'Starting',
						...(input === undefined ? {} : { input }),
					};
					tools.set(tool.id, tool);
					return tool;
				});
			const reasoning = reasoningContent(message.content);
			messages.push({
				id: entry.id,
				role: 'assistant',
				content: textContent(message.content),
				...(reasoning.text ? { reasoning: reasoning.text } : {}),
				...(reasoning.redacted ? { reasoningRedacted: true } : {}),
				createdAt: message.timestamp,
				complete: true,
				tools: messageTools,
			});
			continue;
		}
		if (message.role === 'toolResult') {
			const tool = tools.get(message.toolCallId);
			if (!tool) continue;
			const rawResult = {
				content: message.content,
				details: message.details,
			};
			const isError = message.isError || toolResultIsError(rawResult);
			tool.status = isError ? 'error' : 'complete';
			tool.statusText = isError ? 'Failed' : 'Completed';
			tool.result = normalizeToolResult(rawResult);
		}
	}

	return messages;
}

function treeEntry(
	entry: SessionEntry,
	label: string | undefined,
): SessionTreeEntry | undefined {
	const base = {
		id: entry.id,
		parentId: entry.parentId,
		createdAt: Date.parse(entry.timestamp) || 0,
		...(label ? { label } : {}),
	};
	if (entry.type === 'message') {
		const message = (entry as SessionMessageEntry).message;
		if (message.role === 'toolResult') return;
		if (message.role === 'user') {
			const text = textContent(message.content);
			return { ...base, kind: 'user', summary: oneLine(text), detail: text };
		}
		if (message.role === 'assistant') {
			const text = textContent(message.content);
			const tools = message.content
				.filter((content) => content.type === 'toolCall')
				.map((toolCall) => toolCall.name);
			return {
				...base,
				kind: tools.length && !text ? 'tool' : 'assistant',
				summary: oneLine(text) || tools.join(', ') || 'No output',
				...(text ? { detail: text } : {}),
			};
		}
		return;
	}
	if (entry.type === 'compaction') {
		return { ...base, kind: 'compaction', summary: 'Compacted' };
	}
	if (entry.type === 'branch_summary') {
		return { ...base, kind: 'branch-summary', summary: 'Branch summary' };
	}
	if (entry.type === 'model_change') {
		return {
			...base,
			kind: 'model-change',
			summary: `Model: ${entry.provider}/${entry.modelId}`,
		};
	}
	if (entry.type === 'thinking_level_change') {
		return {
			...base,
			kind: 'thinking-change',
			summary: `Thinking: ${entry.thinkingLevel}`,
		};
	}
}

// Pi has used each of these keys across transcript versions.
function toolCallInput(toolCall: unknown): unknown {
	if (!toolCall || typeof toolCall !== 'object') return;
	const record = toolCall as Record<string, unknown>;
	for (const key of ['args', 'arguments', 'input', 'parameters']) {
		if (record[key] !== undefined) return record[key];
	}
}

function oneLine(text: string): string {
	const line = text.replace(/\s+/g, ' ').trim();
	return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

function textContent(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((item): item is { type: 'text'; text: string } =>
			Boolean(
				item &&
				typeof item === 'object' &&
				'type' in item &&
				item.type === 'text' &&
				'text' in item &&
				typeof item.text === 'string',
			),
		)
		.map((item) => item.text)
		.join('');
}

// A provider can record an opaque thinking block without readable text.
function reasoningContent(content: unknown): {
	text: string;
	redacted: boolean;
} {
	if (!Array.isArray(content)) return { text: '', redacted: false };
	const blocks = content.filter(
		(item): item is { thinking?: unknown; redacted?: unknown } =>
			Boolean(
				item &&
				typeof item === 'object' &&
				'type' in item &&
				item.type === 'thinking',
			),
	);
	return {
		text: blocks
			.map((block) =>
				typeof block.thinking === 'string' ? block.thinking : '',
			)
			.filter(Boolean)
			.join('\n\n'),
		redacted: blocks.some((block) => block.redacted === true),
	};
}
