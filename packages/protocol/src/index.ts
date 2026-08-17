import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

export const protocolVersion = 4 as const;

export const agentToolPolicy = {
	tools: [
		'read',
		'edit',
		'write',
		'unity_status',
		'unity_list_commands',
		'unity_command',
	],
	approvals: false,
	extensions: false,
} as const;

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

export const toolCallViewSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		status: Type.Union([
			Type.Literal('running'),
			Type.Literal('complete'),
			Type.Literal('error'),
		]),
		statusText: Type.String(),
		result: Type.Optional(Type.Unknown()),
	},
	{ additionalProperties: false },
);

export type ToolCallView = Static<typeof toolCallViewSchema>;

export const conversationMessageSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
		content: Type.String(),
		createdAt: Type.Integer({ minimum: 0 }),
		complete: Type.Boolean(),
		tools: Type.Array(toolCallViewSchema),
	},
	{ additionalProperties: false },
);

export type ConversationMessage = Static<typeof conversationMessageSchema>;

export const agentSessionSummarySchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		title: Type.String({ minLength: 1 }),
		projectPath: Type.Optional(Type.String({ minLength: 1 })),
		createdAt: Type.Integer({ minimum: 0 }),
		lastActiveAt: Type.Integer({ minimum: 0 }),
		messageCount: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type AgentSessionSummary = Static<typeof agentSessionSummarySchema>;

export const sessionCatalogSchema = Type.Object(
	{
		sessions: Type.Array(agentSessionSummarySchema),
		lastSessionId: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type SessionCatalog = Static<typeof sessionCatalogSchema>;

export const sessionSnapshotSchema = Type.Object(
	{
		session: agentSessionSummarySchema,
		messages: Type.Array(conversationMessageSchema),
	},
	{ additionalProperties: false },
);

export type SessionSnapshot = Static<typeof sessionSnapshotSchema>;

export const agentModelOptionSchema = Type.Object(
	{
		provider: Type.String({ minLength: 1 }),
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		reasoning: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export type AgentModelOption = Static<typeof agentModelOptionSchema>;

export const agentModelCatalogSchema = Type.Object(
	{
		current: Type.Optional(
			Type.Object(
				{
					provider: Type.String({ minLength: 1 }),
					id: Type.String({ minLength: 1 }),
					thinkingLevel: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
		models: Type.Array(agentModelOptionSchema),
		thinkingLevels: Type.Array(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type AgentModelCatalog = Static<typeof agentModelCatalogSchema>;

const unityCliMessageSchema = Type.Object(
	{
		code: Type.String(),
		message: Type.String(),
	},
	{ additionalProperties: false },
);

export const unityProjectSchema = Type.Object(
	{
		title: Type.String({ minLength: 1 }),
		path: Type.String({ minLength: 1 }),
		version: Type.Optional(Type.String()),
		lastModified: Type.Optional(Type.Integer({ minimum: 0 })),
		isFavorite: Type.Boolean(),
		buildTarget: Type.Optional(Type.String()),
		renderPipeline: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type UnityProject = Static<typeof unityProjectSchema>;

export const unityStatusSchema = Type.Object(
	{
		state: Type.Union([
			Type.Literal('connected'),
			Type.Literal('disconnected'),
			Type.Literal('unavailable'),
			Type.Literal('error'),
		]),
		ok: Type.Boolean(),
		command: Type.Array(Type.String()),
		exitCode: Type.Union([Type.Integer(), Type.Null()]),
		durationMs: Type.Integer({ minimum: 0 }),
		instances: Type.Array(Type.Record(Type.String(), Type.Unknown())),
		errors: Type.Array(unityCliMessageSchema),
		warnings: Type.Array(unityCliMessageSchema),
		stderr: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type UnityStatus = Static<typeof unityStatusSchema>;

export const unityOpenProjectResultSchema = Type.Object(
	{
		state: Type.Union([
			Type.Literal('opened'),
			Type.Literal('already_open'),
			Type.Literal('error'),
		]),
		ok: Type.Boolean(),
		command: Type.Array(Type.String()),
		exitCode: Type.Union([Type.Integer(), Type.Null()]),
		durationMs: Type.Integer({ minimum: 0 }),
		data: Type.Unknown(),
		errors: Type.Array(unityCliMessageSchema),
		warnings: Type.Array(unityCliMessageSchema),
		stderr: Type.Optional(Type.String()),
		status: Type.Optional(unityStatusSchema),
	},
	{ additionalProperties: false },
);

export type UnityOpenProjectResult = Static<
	typeof unityOpenProjectResultSchema
>;

export const agentRequestSchema = Type.Union([
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.list'),
		},
		{ additionalProperties: false },
	),
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
			type: Type.Literal('session.resume'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.rename'),
			sessionId: Type.String({ minLength: 1 }),
			title: Type.String({ minLength: 1, maxLength: 200 }),
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
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.delete'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('model.catalog'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('model.select'),
			sessionId: Type.String({ minLength: 1 }),
			provider: Type.String({ minLength: 1 }),
			modelId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('thinking.select'),
			sessionId: Type.String({ minLength: 1 }),
			level: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.list'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.status'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.open'),
			projectPath: Type.String({ minLength: 1 }),
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
			result: Type.Optional(Type.Unknown()),
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
			tools: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
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

export function parseUnityProjects(input: unknown): UnityProject[] {
	const schema = Type.Array(unityProjectSchema);
	if (!Value.Check(schema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseSessionCatalog(input: unknown): SessionCatalog {
	if (!Value.Check(sessionCatalogSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseSessionSnapshot(input: unknown): SessionSnapshot {
	if (!Value.Check(sessionSnapshotSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseAgentModelCatalog(input: unknown): AgentModelCatalog {
	if (!Value.Check(agentModelCatalogSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseUnityStatus(input: unknown): UnityStatus {
	if (!Value.Check(unityStatusSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseUnityOpenProjectResult(
	input: unknown,
): UnityOpenProjectResult {
	if (!Value.Check(unityOpenProjectResultSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}
