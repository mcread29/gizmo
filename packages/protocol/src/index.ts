import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

export const protocolVersion = 1 as const;

export interface AgentIdentity {
	name: string;
	version: string;
	capabilities: readonly string[];
}

const envelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};

const eventEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	eventId: Type.Integer({ minimum: 1 }),
	sessionId: Type.String({ minLength: 1 }),
};

const responseEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};

export const sessionOptionsSchema = Type.Object(
	{
		cwd: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type SessionOptions = Static<typeof sessionOptionsSchema>;

export const agentRequestSchema = Type.Union([
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.create'),
			options: sessionOptionsSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.prompt'),
			sessionId: Type.String({ minLength: 1 }),
			text: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.steer'),
			sessionId: Type.String({ minLength: 1 }),
			text: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.abort'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
]);

export type AgentRequest = Static<typeof agentRequestSchema>;

export const agentResponseSchema = Type.Union([
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.success'),
			sessionId: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.error'),
			code: Type.String({ minLength: 1 }),
			message: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
]);

export type AgentResponse = Static<typeof agentResponseSchema>;

export const sessionStateSchema = Type.Union([
	Type.Literal('idle'),
	Type.Literal('streaming'),
	Type.Literal('error'),
]);

export type SessionState = Static<typeof sessionStateSchema>;

export const agentEventSchema = Type.Union([
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.created'),
			title: Type.String(),
			model: Type.Optional(
				Type.Object(
					{
						provider: Type.String({ minLength: 1 }),
						id: Type.String({ minLength: 1 }),
						thinkingLevel: Type.String({ minLength: 1 }),
					},
					{ additionalProperties: false },
				),
			),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.state'),
			state: sessionStateSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.started'),
			messageId: Type.String({ minLength: 1 }),
			role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
			createdAt: Type.Integer({ minimum: 0 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.delta'),
			messageId: Type.String({ minLength: 1 }),
			delta: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.completed'),
			messageId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.started'),
			messageId: Type.String({ minLength: 1 }),
			toolCallId: Type.String({ minLength: 1 }),
			toolName: Type.String({ minLength: 1 }),
			input: Type.Unknown(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.updated'),
			toolCallId: Type.String({ minLength: 1 }),
			message: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.completed'),
			toolCallId: Type.String({ minLength: 1 }),
			result: Type.Unknown(),
			isError: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('error'),
			code: Type.String({ minLength: 1 }),
			message: Type.String({ minLength: 1 }),
			requestId: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
]);

export type AgentEvent = Static<typeof agentEventSchema>;

export class ProtocolValidationError extends Error {
	constructor(kind: 'request' | 'response' | 'event', input: unknown) {
		super(`Invalid agent protocol ${kind}`);
		this.name = 'ProtocolValidationError';
		this.cause = input;
	}
}

export function parseAgentRequest(input: unknown): AgentRequest {
	if (!Value.Check(agentRequestSchema, input)) {
		throw new ProtocolValidationError('request', input);
	}
	return input;
}

export function parseAgentResponse(input: unknown): AgentResponse {
	if (!Value.Check(agentResponseSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseAgentEvent(input: unknown): AgentEvent {
	if (!Value.Check(agentEventSchema, input)) {
		throw new ProtocolValidationError('event', input);
	}
	return input;
}
