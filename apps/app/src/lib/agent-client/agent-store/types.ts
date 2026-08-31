import type { AgentEvent } from '@gizmo/protocol';

export interface AgentModel {
	provider: string;
	id: string;
	thinkingLevel: string;
	/** The model's context limit, when it reports one. */
	contextWindow?: number;
}

export type AgentErrorKind =
	'connection' | 'prompt' | 'session' | 'project' | 'agent';

export interface AgentError {
	kind: AgentErrorKind;
	message: string;
}

export type PendingConfirmation = Extract<
	AgentEvent,
	{ type: 'confirmation.requested' }
>;

export type ConnectionState =
	'disconnected' | 'connecting' | 'reconnecting' | 'connected';
