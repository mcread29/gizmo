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
	/** The extension's stored settings, as the server holds them. */
	Type.Object(
		{ ...envelope, type: Type.Literal('extension.settings.get'), extensionId },
		{ additionalProperties: false },
	),
	/**
	 * Merges values into the extension's stored settings. A `null` value
	 * clears that key; every other value is checked against the field the
	 * extension declared for it.
	 */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extension.settings.set'),
			extensionId,
			values: Type.Record(Type.String(), Type.Unknown()),
		},
		{ additionalProperties: false },
	),
] as const;
