import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { boundedJson } from './bounded-json';
import { strict, label } from './view-primitives';
import { blockSchema } from './view-blocks';
import { actionSchema } from './view-actions';
export * from './view-actions';
export * from './view-blocks';

/**
 * A view is a title, a status, and blocks. Everything it can contain lives
 * in `view-blocks.ts`; this file is the envelope and its validation.
 */

export const viewStatusSchema = Type.Union([
	Type.Literal('idle'),
	Type.Literal('running'),
	Type.Literal('success'),
	Type.Literal('warning'),
	Type.Literal('error'),
]);
export type ViewStatus = Static<typeof viewStatusSchema>;

/** One rendered surface: an inspector tab, a modal, or a tool result card. */
export const viewSchema = Type.Object(
	{
		title: label,
		status: Type.Optional(viewStatusSchema),
		/** Shown on the tab that opens this view. */
		badge: Type.Optional(Type.Integer({ minimum: 0 })),
		badgeTone: Type.Optional(
			Type.Union([Type.Literal('accent'), Type.Literal('danger')]),
		),
		blocks: Type.Array(blockSchema, { maxItems: 500 }),
		actions: Type.Optional(Type.Array(actionSchema, { maxItems: 50 })),
	},
	strict,
);
export type View = Static<typeof viewSchema>;

/** Bytes of JSON a single view may occupy on the wire. */
export const maxViewBytes = 1_000_000;

/**
 * Validates a view an extension produced. The host validates on the server
 * before it is stored or sent, and again where it renders, so a broken view
 * from one extension is dropped with a diagnostic instead of breaking a tab.
 */
export function parseView(value: unknown): View | undefined {
	try {
		if (!boundedJson(value, maxViewBytes, 200_000)) return undefined;
		if (!Value.Check(viewSchema, value)) return undefined;
		return JSON.parse(JSON.stringify(value)) as View;
	} catch {
		return undefined;
	}
}

export function viewIssues(value: unknown): string[] {
	if (!boundedJson(value, maxViewBytes, 200_000))
		return ['view is not plain JSON within the size budget'];
	return [...Value.Errors(viewSchema, value)]
		.slice(0, 5)
		.map((error) => `${error.instancePath || '/'}: ${error.message}`);
}
