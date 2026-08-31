import { Type, type Static } from 'typebox';
import { eventEnvelope } from './envelopes';
import {
	extensionDescriptorSchema,
	extensionUiRequestSchema,
} from './extensions';
import { unityStatusSchema } from './projects';
import { conversationAttachmentSchema, sessionUsageSchema } from './sessions';

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
			domains: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
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
			type: Type.Literal('session.compaction'),
			active: Type.Boolean(),
			reason: Type.Union([
				Type.Literal('manual'),
				Type.Literal('threshold'),
				Type.Literal('overflow'),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('confirmation.requested'),
			confirmationId: Type.String({ minLength: 1 }),
			kind: Type.Literal('stop_play_mode_for_compile'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extension.ui.requested'),
			runtimeId: Type.String({ minLength: 1 }),
			uiRequestId: Type.String({ minLength: 1 }),
			request: extensionUiRequestSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extension.ui.cancelled'),
			runtimeId: Type.String({ minLength: 1 }),
			uiRequestId: Type.String({ minLength: 1 }),
			reason: Type.Union([
				Type.Literal('timeout'),
				Type.Literal('signal'),
				Type.Literal('runtime'),
				Type.Literal('abort'),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extension.ui.runtime.cleared'),
			runtimeId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('project.status.changed'),
			projectPath: Type.String({ minLength: 1 }),
			status: unityStatusSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('project.extensions.changed'),
			projectPath: Type.String({ minLength: 1 }),
			extensions: Type.Array(extensionDescriptorSchema),
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
			attachments: Type.Optional(Type.Array(conversationAttachmentSchema)),
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
			type: Type.Literal('session.usage'),
			usage: sessionUsageSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.reasoning'),
			messageId: Type.String({ minLength: 1 }),
			delta: Type.String(),
			redacted: Type.Optional(Type.Boolean()),
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
