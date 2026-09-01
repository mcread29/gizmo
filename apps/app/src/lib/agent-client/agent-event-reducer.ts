import type {
	AgentEvent,
	AgentSessionSummary,
	ConversationMessage,
	SessionState,
	SessionUsage,
	ExtensionDescriptor,
} from '@gizmo/protocol';

export interface AgentEventState {
	model?: { provider: string; id: string; thinkingLevel: string };
	activeTools: string[];
	enabledExtensionIds?: string[];
	sessionState: SessionState;
	compacting: boolean;
	lastAutomaticCompactionReason?: 'threshold' | 'overflow';
	usage?: SessionUsage;
	messages: ConversationMessage[];
	sessions: AgentSessionSummary[];
	sessionId?: string;
	selectedProjectPath?: string;
	projectExtensions: ExtensionDescriptor[];
	projectStatuses: Record<string, unknown>;
	projectServiceErrors: Record<string, string>;
	projectError?: string;
}

/** Applies a validated event and returns an agent error message when present. */
export function applyAgentEvent(
	state: AgentEventState,
	event: AgentEvent,
): string | undefined {
	switch (event.type) {
		case 'session.created':
			state.model = event.model;
			state.enabledExtensionIds = event.domains ?? [];
			state.activeTools = event.tools ?? [];
			break;
		case 'session.state':
			state.sessionState = event.state;
			break;
		case 'session.compaction':
			state.compacting = event.active;
			if (!event.active) {
				state.usage = undefined;
				if (event.reason !== 'manual') {
					state.lastAutomaticCompactionReason = event.reason;
				}
			}
			break;
		case 'session.usage':
			state.usage = event.usage;
			break;
		case 'message.started':
			state.messages.push({
				id: event.messageId,
				role: event.role,
				content: '',
				createdAt: event.createdAt,
				complete: false,
				tools: [],
				...(event.attachments ? { attachments: event.attachments } : {}),
			});
			incrementMessageCount(state);
			break;
		case 'message.delta': {
			const message = findMessage(state, event.messageId);
			if (message) message.content += event.delta;
			break;
		}
		case 'message.reasoning': {
			const message = findMessage(state, event.messageId);
			if (message) {
				if (event.delta) {
					message.reasoning = (message.reasoning ?? '') + event.delta;
				}
				if (event.redacted) message.reasoningRedacted = true;
			}
			break;
		}
		case 'message.completed': {
			const message = findMessage(state, event.messageId);
			if (message) message.complete = true;
			break;
		}
		case 'tool.started':
			findMessage(state, event.messageId)?.tools.push({
				id: event.toolCallId,
				name: event.toolName,
				status: 'running',
				statusText: 'Starting',
				...(event.input === undefined ? {} : { input: event.input }),
			});
			break;
		case 'tool.updated': {
			const tool = findTool(state, event.toolCallId);
			if (tool) tool.statusText = event.message;
			break;
		}
		case 'tool.completed': {
			const tool = findTool(state, event.toolCallId);
			if (tool) {
				tool.status = event.isError ? 'error' : 'complete';
				tool.statusText = event.isError ? 'Failed' : 'Completed';
				tool.result = event.result;
			}
			break;
		}
		case 'project.status.changed':
			if (event.projectPath === state.selectedProjectPath) {
				state.projectStatuses = {
					...state.projectStatuses,
					[event.extensionId]: event.status,
				};
				if (event.extensionId in state.projectServiceErrors) {
					const remainingErrors = { ...state.projectServiceErrors };
					delete remainingErrors[event.extensionId];
					state.projectServiceErrors = remainingErrors;
				}
			}
			break;
		case 'project.extensions.changed':
			if (event.projectPath === state.selectedProjectPath) {
				state.projectExtensions = event.extensions;
			}
			break;
		case 'error':
			state.sessionState = 'error';
			return event.message;
	}
}

function findMessage(state: AgentEventState, messageId: string) {
	for (let index = state.messages.length - 1; index >= 0; index--) {
		const message = state.messages[index];
		if (message?.id === messageId) return message;
	}
}

function findTool(state: AgentEventState, toolCallId: string) {
	for (let index = state.messages.length - 1; index >= 0; index--) {
		const tools = state.messages[index]?.tools ?? [];
		for (let toolIndex = tools.length - 1; toolIndex >= 0; toolIndex--) {
			const tool = tools[toolIndex];
			if (tool?.id === toolCallId) return tool;
		}
	}
}

function incrementMessageCount(state: AgentEventState): void {
	const session = state.sessions.find(({ id }) => id === state.sessionId);
	if (session) session.messageCount++;
}
