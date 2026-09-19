import { actionEventSchema } from '@gizmo/extension-api';
import { Type } from 'typebox';
import { envelope } from '../envelopes';

const projectPath = Type.String({ minLength: 1 });
const extensionId = Type.String({ minLength: 1, maxLength: 128 });
const viewId = Type.String({ minLength: 1, maxLength: 160 });
const sessionId = Type.Optional(Type.String({ minLength: 1 }));

/**
 * Extension UI as data. `extensions.ui` lists what the enabled extensions
 * contribute; a view is opened per connection and streams
 * `extension.view.updated` events until closed (or the socket drops).
 */
export const extensionUiRequestSchemas = [
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extensions.ui'),
			projectPath,
			sessionId,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extension.view.open'),
			projectPath,
			extensionId,
			viewId,
			sessionId,
			/** Client-local settings values for the extension, if any. */
			settings: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extension.view.close'),
			projectPath,
			extensionId,
			viewId,
			sessionId,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extension.view.action'),
			projectPath,
			extensionId,
			viewId,
			sessionId,
			event: actionEventSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extension.command.run'),
			projectPath,
			extensionId,
			commandId: Type.String({ minLength: 1, maxLength: 160 }),
			sessionId,
		},
		{ additionalProperties: false },
	),
] as const;
