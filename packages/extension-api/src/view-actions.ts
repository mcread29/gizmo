import { Type, type Static } from 'typebox';
import {
	strict,
	identifier,
	label,
	webUrl,
	text,
	path,
} from './view-primitives';

export const actionInputSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Union([Type.Literal('text'), Type.Literal('multiline')]),
			label,
			placeholder: Type.Optional(label),
			initialValue: Type.Optional(text),
			required: Type.Optional(Type.Boolean()),
		},
		strict,
	),
	Type.Object(
		{
			kind: Type.Literal('select'),
			label,
			required: Type.Optional(Type.Boolean()),
			options: Type.Array(Type.Object({ value: label, label }, strict), {
				minItems: 1,
				maxItems: 500,
			}),
		},
		strict,
	),
]);
export type ActionInput = Static<typeof actionInputSchema>;

const intentTargetSchema = Type.Union([
	Type.Object({ kind: Type.Literal('path'), path }, strict),
	Type.Object({ kind: Type.Literal('selection'), blockId: identifier }, strict),
]);

/**
 * Something the host does on the client without a round trip to the
 * extension: open a file or its diff, switch to a thread, or open a web page.
 */
export const intentSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Literal('openFile'),
			target: intentTargetSchema,
			line: Type.Optional(Type.Integer({ minimum: 1 })),
			column: Type.Optional(Type.Integer({ minimum: 1 })),
		},
		strict,
	),
	Type.Object(
		{ kind: Type.Literal('openDiff'), target: intentTargetSchema },
		strict,
	),
	Type.Object(
		{ kind: Type.Literal('openThread'), sessionId: identifier },
		strict,
	),
	/** Opened in the user's browser; only web URLs are accepted. */
	Type.Object({ kind: Type.Literal('openUrl'), url: webUrl }, strict),
]);
export type Intent = Static<typeof intentSchema>;

export const actionSchema = Type.Object(
	{
		id: identifier,
		label,
		tone: Type.Optional(
			Type.Union([
				Type.Literal('default'),
				Type.Literal('primary'),
				Type.Literal('danger'),
			]),
		),
		disabled: Type.Optional(Type.Boolean()),
		/** Needs an item picked in the named list/table/tree block. */
		selection: Type.Optional(
			Type.Object(
				{ blockId: identifier, required: Type.Optional(Type.Boolean()) },
				strict,
			),
		),
		confirm: Type.Optional(
			Type.Object({ title: label, message: text }, strict),
		),
		input: Type.Optional(actionInputSchema),
		/** Handled on the client; the extension is not called. */
		intent: Type.Optional(intentSchema),
	},
	strict,
);
export type Action = Static<typeof actionSchema>;

/** What the host sends back when the user runs an action. */
export const actionEventSchema = Type.Object(
	{
		actionId: identifier,
		selection: Type.Optional(
			Type.Object({ blockId: identifier, itemId: identifier }, strict),
		),
		value: Type.Optional(text),
		cancelled: Type.Boolean(),
	},
	strict,
);
export type ActionEvent = Static<typeof actionEventSchema>;

export const actionResultSchema = Type.Object(
	{
		status: Type.Union([
			Type.Literal('succeeded'),
			Type.Literal('rejected'),
			Type.Literal('failed'),
		]),
		message: Type.Optional(text),
	},
	strict,
);
export type ActionResult = Static<typeof actionResultSchema>;
