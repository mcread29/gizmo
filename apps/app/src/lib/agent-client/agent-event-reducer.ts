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
	/** Steered text a dead run never delivered, waiting to go back to the composer. */
	unsent: string[];
	/** Text queued against the run in flight, shown in the thread until delivered. */
	queue: { steering: string[]; followUp: string[] };
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
		case 'session.state': {
			// Only a run this client watched end says anything about how long
			// it took. Opening an old thread also reports idle, and stamping
			// that moment claimed the agent had been working since the thread
			// was last touched — days, in one case.
			const ended =
				state.sessionState === 'streaming' && event.state === 'idle';
			state.sessionState = event.state;
			// Nothing can be queued against a run that is over.
			if (event.state !== 'streaming') state.queue = emptyQueue();
			// The turn — not the message — is what the thread reports the
			// duration of. Individual assistant messages complete several
			// times within one run.
			if (ended) stampTurnEnd(state);
			break;
		}
		case 'session.queue':
			state.queue = {
				steering: [...event.steering],
				followUp: [...event.followUp],
			};
			break;
		case 'session.unsent':
			state.unsent = [...state.unsent, ...event.messages];
			break;
		case 'session.compaction':
			state.compacting = event.active;
			if (!event.active) {
				state.usage = undefined;
				// A completed compaction becomes a row in the thread, where the
				// history it rewrote was; a resync reads the same row back from
				// the session file.
				if (event.result) {
					state.messages.push({
						id: `compaction-${event.eventId}`,
						role: 'event',
						content: '',
						createdAt: Date.now(),
						complete: true,
						tools: [],
						event: {
							kind: 'compaction',
							reason: event.reason,
							tokensBefore: event.result.tokensBefore,
							summary: event.result.summary,
						},
					});
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
			if (message) {
				message.complete = true;
				if (event.interrupted) message.interrupted = true;
			}
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
			if (tool) {
				tool.statusText = event.message;
				if (event.result !== undefined) tool.result = event.result;
			}
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

export function emptyQueue(): AgentEventState['queue'] {
	return { steering: [], followUp: [] };
}

/** Marks the turn's last assistant message with the moment the run stopped. */
function stampTurnEnd(state: AgentEventState): void {
	for (let index = state.messages.length - 1; index >= 0; index--) {
		const message = state.messages[index];
		if (message.role === 'user') return;
		if (message.role !== 'assistant') continue;
		if (message.completedAt === undefined) message.completedAt = Date.now();
		return;
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
