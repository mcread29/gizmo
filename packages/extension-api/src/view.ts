import { Type, type Static, type TProperties } from 'typebox';
import { Value } from 'typebox/value';
import { boundedJson } from './bounded-json';
import {
	strict,
	identifier,
	label,
	webUrl,
	text,
	path,
} from './view-primitives';
import { actionSchema } from './view-actions';
export * from './view-actions';

/**
 * The view protocol: what an extension shows in Gizmo, as data. The host
 * owns every component; an extension composes these blocks and never ships
 * browser code. When a block is missing it is added here, for everyone.
 */

export const toneSchema = Type.Union([
	Type.Literal('default'),
	Type.Literal('muted'),
	Type.Literal('info'),
	Type.Literal('success'),
	Type.Literal('warning'),
	Type.Literal('error'),
]);
export type Tone = Static<typeof toneSchema>;

const tone = Type.Optional(toneSchema);

const listItemSchema = Type.Object(
	{
		id: identifier,
		label,
		detail: Type.Optional(text),
		path: Type.Optional(path),
		tone,
		disabled: Type.Optional(Type.Boolean()),
	},
	strict,
);

const treeNodeSchema = Type.Cyclic(
	{
		TreeNode: Type.Object(
			{
				id: identifier,
				label,
				detail: Type.Optional(text),
				path: Type.Optional(path),
				tone,
				disabled: Type.Optional(Type.Boolean()),
				expanded: Type.Optional(Type.Boolean()),
				children: Type.Optional(
					Type.Array(Type.Ref('TreeNode'), { maxItems: 2_000 }),
				),
			},
			strict,
		),
	},
	'TreeNode',
);
export type TreeNode = Static<typeof treeNodeSchema>;

const block = <T extends string, P extends TProperties>(
	type: T,
	properties: P,
) => Type.Object({ type: Type.Literal(type), ...properties }, strict);

export const blockSchema = Type.Cyclic(
	{
		Block: Type.Union([
			block('heading', {
				text: label,
				level: Type.Optional(
					Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
				),
			}),
			block('text', { text, tone }),
			block('markdown', { markdown: text }),
			block('keyValue', {
				entries: Type.Array(Type.Object({ label, value: text, tone }, strict), {
					maxItems: 200,
				}),
			}),
			block('metric', {
				label,
				value: label,
				description: Type.Optional(text),
				tone,
			}),
			block('list', {
				id: identifier,
				items: Type.Array(listItemSchema, { maxItems: 2_000 }),
				selectedId: Type.Optional(identifier),
				empty: Type.Optional(label),
			}),
			block('table', {
				id: identifier,
				columns: Type.Array(
					Type.Object(
						{
							id: identifier,
							label,
							align: Type.Optional(
								Type.Union([
									Type.Literal('start'),
									Type.Literal('center'),
									Type.Literal('end'),
								]),
							),
						},
						strict,
					),
					{ minItems: 1, maxItems: 30 },
				),
				rows: Type.Array(
					Type.Object(
						{
							id: identifier,
							cells: Type.Record(Type.String({ maxLength: 160 }), text),
							path: Type.Optional(path),
							tone,
							disabled: Type.Optional(Type.Boolean()),
						},
						strict,
					),
					{ maxItems: 2_000 },
				),
				selectedId: Type.Optional(identifier),
				empty: Type.Optional(label),
			}),
			block('tree', {
				id: identifier,
				nodes: Type.Array(treeNodeSchema, { maxItems: 2_000 }),
				selectedId: Type.Optional(identifier),
				empty: Type.Optional(label),
			}),
			block('progress', {
				value: Type.Number({ minimum: 0 }),
				max: Type.Number({ exclusiveMinimum: 0 }),
				label: Type.Optional(label),
				tone,
			}),
			block('log', {
				id: Type.Optional(identifier),
				lines: Type.Array(
					Type.Object(
						{
							text,
							tone,
							timestamp: Type.Optional(Type.Number({ minimum: 0 })),
						},
						strict,
					),
					{ maxItems: 5_000 },
				),
				truncated: Type.Optional(Type.Boolean()),
				follow: Type.Optional(Type.Boolean()),
			}),
			block('code', {
				code: text,
				language: Type.Optional(Type.String({ maxLength: 40 })),
				label: Type.Optional(label),
			}),
			block('diff', {
				diff: Type.String({ maxLength: 500_000 }),
				file: Type.Optional(path),
			}),
			block('section', {
				title: label,
				collapsed: Type.Optional(Type.Boolean()),
				blocks: Type.Array(Type.Ref('Block'), { maxItems: 200 }),
			}),
			block('divider', {}),
			/** An inline web link, rendered as an anchor the host opens. */
			block('link', { text: label, url: webUrl }),
		]),
	},
	'Block',
);
export type Block = Static<typeof blockSchema>;

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
