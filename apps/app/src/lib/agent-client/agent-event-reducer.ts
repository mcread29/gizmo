import type {
	AgentEvent,
	AgentSessionSummary,
	ConversationMessage,
	SessionState,
	SessionUsage,
	UnityConsoleEntry,
	UnityStatus,
} from '@unity-agent/protocol';
const consoleLimit = 500;

export interface AgentEventState {
	model?: { provider: string; id: string; thinkingLevel: string };
	activeTools: string[];
	sessionState: SessionState;
	compacting: boolean;
	usage?: SessionUsage;
	messages: ConversationMessage[];
	sessions: AgentSessionSummary[];
	sessionId?: string;
	selectedProjectPath?: string;
	consoleEntries: UnityConsoleEntry[];
	projectStatus?: UnityStatus;
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
			state.activeTools = event.tools ?? [];
			break;
		case 'session.state':
			state.sessionState = event.state;
			break;
		case 'session.compaction':
			state.compacting = event.active;
			if (!event.active) state.usage = undefined;
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
		case 'project.console.appended':
			if (event.projectPath === state.selectedProjectPath) {
				state.consoleEntries = [
					...state.consoleEntries,
					...event.update.entries,
				].slice(-consoleLimit);
			}
			break;
		case 'project.status.changed':
			if (event.projectPath === state.selectedProjectPath) {
				state.projectStatus = event.status;
				state.projectError = undefined;
			}
			break;
		case 'error':
			state.sessionState = 'error';
			return event.message;
	}
}

function findMessage(state: AgentEventState, messageId: string) {
	return state.messages.find((message) => message.id === messageId);
}

function findTool(state: AgentEventState, toolCallId: string) {
	for (const message of state.messages) {
		const tool = message.tools.find((candidate) => candidate.id === toolCallId);
		if (tool) return tool;
	}
}

function incrementMessageCount(state: AgentEventState): void {
	const session = state.sessions.find(({ id }) => id === state.sessionId);
	if (session) session.messageCount++;
}
