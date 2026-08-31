import { Type } from 'typebox';
import { envelope } from '../envelopes';
import { extensionUiResponseSchema } from '../extensions';
import {
	agentAttachmentSchema,
	compactionPolicySchema,
	sessionOptionsSchema,
} from '../sessions';

export const sessionRequestSchemas = [
	Type.Object(
		{ ...envelope, type: Type.Literal('providers.list') },
		{ additionalProperties: false },
	),
	Type.Object(
		{ ...envelope, type: Type.Literal('providers.import-pi-auth') },
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('attachment.read'),
			sessionId: Type.String({ minLength: 1 }),
			attachmentId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('attachment.reveal'),
			sessionId: Type.String({ minLength: 1 }),
			attachmentId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
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
			compaction: Type.Optional(compactionPolicySchema),
			attachments: Type.Optional(
				Type.Array(agentAttachmentSchema, { maxItems: 8 }),
			),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.commands'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.compact'),
			sessionId: Type.String({ minLength: 1 }),
			compaction: compactionPolicySchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.reload'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.steer'),
			sessionId: Type.String({ minLength: 1 }),
			text: Type.String({ minLength: 1 }),
			attachments: Type.Optional(
				Type.Array(agentAttachmentSchema, { maxItems: 8 }),
			),
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
			type: Type.Literal('confirmation.resolve'),
			sessionId: Type.String({ minLength: 1 }),
			confirmationId: Type.String({ minLength: 1 }),
			accepted: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.tree'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.branch'),
			sessionId: Type.String({ minLength: 1 }),
			/** Null rewinds past the first entry, to re-run the opening prompt. */
			entryId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.label'),
			sessionId: Type.String({ minLength: 1 }),
			entryId: Type.String({ minLength: 1 }),
			/** Omitted clears the label. */
			label: Type.Optional(Type.String({ maxLength: 120 })),
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
			type: Type.Literal('extension.ui.respond'),
			sessionId: Type.String({ minLength: 1 }),
			runtimeId: Type.String({ minLength: 1 }),
			uiRequestId: Type.String({ minLength: 1 }),
			response: extensionUiResponseSchema,
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
] as const;
