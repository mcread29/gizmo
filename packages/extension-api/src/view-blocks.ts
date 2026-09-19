import { Type, type Static, type TProperties } from 'typebox';
import {
	strict,
	identifier,
	label,
	webUrl,
	text,
	path,
} from './view-primitives';

/**
 * The blocks a view is built from. The host owns every component; an
 * extension composes these and never ships browser code. When a block is
 * missing it is added here, for everyone.
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

/** A short status chip on a row, e.g. Git's `M` or `??`. */
const badgeSchema = Type.Object(
	{ text: Type.String({ minLength: 1, maxLength: 24 }), tone },
	strict,
);

/**
 * Adornments every selectable row shares. An `icon` names a lucide icon the
 * host knows; an unknown name is dropped rather than drawn as a fallback, so
 * a row never gains a puzzle piece it did not ask for.
 */
const decoration = {
	icon: Type.Optional(label),
	badge: Type.Optional(badgeSchema),
};

/** An action id the host runs when the user picks a row in this block. */
const onSelect = Type.Optional(identifier);

/**
 * The ids of the block's `item` actions this row carries, for when only some
 * of them apply to it: a folder in a file tree can be staged, but there is no
 * file there to open. Absent means the row carries all of them.
 */
const rowActions = Type.Optional(Type.Array(identifier, { maxItems: 20 }));

const listItemSchema = Type.Object(
	{
		id: identifier,
		label,
		detail: Type.Optional(text),
		path: Type.Optional(path),
		tone,
		disabled: Type.Optional(Type.Boolean()),
		actions: rowActions,
		...decoration,
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
				actions: rowActions,
				...decoration,
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
				onSelect,
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
							actions: rowActions,
							...decoration,
						},
						strict,
					),
					{ maxItems: 2_000 },
				),
				selectedId: Type.Optional(identifier),
				onSelect,
				empty: Type.Optional(label),
			}),
			block('tree', {
				id: identifier,
				nodes: Type.Array(treeNodeSchema, { maxItems: 2_000 }),
				selectedId: Type.Optional(identifier),
				onSelect,
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
			/**
			 * Panes that divide the space they are given, each scrolling on
			 * its own: a browser above its detail, a list beside its subject.
			 * The host stacks them vertically in a narrow container whatever
			 * `direction` asks for, because the inspector is one column wide.
			 */
			block('split', {
				direction: Type.Optional(
					Type.Union([Type.Literal('vertical'), Type.Literal('horizontal')]),
				),
				panes: Type.Array(
					Type.Object(
						{
							blocks: Type.Array(Type.Ref('Block'), { maxItems: 200 }),
							/** Share of the free space, relative to its siblings. */
							grow: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
						},
						strict,
					),
					{ minItems: 2, maxItems: 4 },
				),
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
