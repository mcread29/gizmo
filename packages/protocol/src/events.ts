import { viewSchema } from '@gizmo/extension-api';
import { Type, type Static } from 'typebox';
import { appUpdateChangedEventSchema } from './app-update';
import { eventEnvelope } from './envelopes';
import {
	extensionDescriptorSchema,
	extensionSettingsChangedEventSchema,
	extensionUiRequestSchema,
} from './extensions';
import { projectCompactionChangedEventSchema } from './compaction';
import {
	compactionReasonSchema,
	conversationAttachmentSchema,
	sessionStateSchema,
	sessionUsageSchema,
} from './sessions';

export const agentEventSchema = Type.Union([
	appUpdateChangedEventSchema,
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
	/**
	 * Messages queued against a run that ended before delivering them. The run
	 * dying — aborted, or dropped by the provider — strands anything steered
	 * into it, so the text comes back to the client to be restored rather than
	 * silently lost.
	 */
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.unsent'),
			messages: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
		},
		{ additionalProperties: false },
	),
	/**
	 * Text queued against the run in flight. Steering is delivered at the next
	 * model call; follow-ups wait for the run to finish. Sent whenever the
	 * queue changes, so the thread can show what is still waiting.
	 */
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.queue'),
			steering: Type.Array(Type.String()),
			followUp: Type.Array(Type.String()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.compaction'),
			active: Type.Boolean(),
			reason: compactionReasonSchema,
			/** Present when a completed compaction actually rewrote history. */
			result: Type.Optional(
				Type.Object(
					{
						tokensBefore: Type.Integer({ minimum: 0 }),
						summary: Type.String(),
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
			type: Type.Literal('confirmation.requested'),
			confirmationId: Type.String({ minLength: 1 }),
			/** Extension-defined; the client shows `title`/`message` when given. */
			kind: Type.String({ minLength: 1, maxLength: 160 }),
			projectPath: Type.String({ minLength: 1 }),
			title: Type.Optional(Type.String({ maxLength: 200 })),
			message: Type.Optional(Type.String({ maxLength: 2_000 })),
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
			/** Which extension's project service produced this status. */
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
			/** Opaque extension-owned payload; consumers validate their own shape. */
			status: Type.Unknown(),
		},
		{ additionalProperties: false },
	),
	projectCompactionChangedEventSchema,
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('project.extensions.changed'),
			projectPath: Type.String({ minLength: 1 }),
			extensions: Type.Array(extensionDescriptorSchema),
		},
		{ additionalProperties: false },
	),
	/** A view this connection opened has new content. */
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extension.view.updated'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
			viewId: Type.String({ minLength: 1, maxLength: 160 }),
			viewSessionId: Type.Optional(Type.String({ minLength: 1 })),
			view: viewSchema,
		},
		{ additionalProperties: false },
	),
	/**
	 * An extension's status items or commands changed; clients re-fetch
	 * `extensions.ui` for the workspace (or every workspace when unset).
	 */
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extensions.ui.changed'),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
			projectPath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	extensionSettingsChangedEventSchema,
	/**
	 * The server reloaded its extension catalog (an explicit reload, a
	 * registry change, or the dev file watcher). Broadcast to every
	 * connection so each tab re-fetches descriptors and UI contributions.
	 */
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('extensions.reloaded'),
			generation: Type.Integer({ minimum: 0 }),
			extensions: Type.Array(Type.String({ minLength: 1, maxLength: 128 })),
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
			/** The turn stopped early rather than running to a natural end. */
			interrupted: Type.Optional(Type.Boolean()),
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
			result: Type.Optional(Type.Unknown()),
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
