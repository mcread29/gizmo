import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

const strict = { additionalProperties: false };
const text = Type.String({ maxLength: 4_000 });
const title = Type.String({ maxLength: 200 });
const id = Type.String({
	minLength: 1,
	maxLength: 64,
	pattern: '^(?!__proto__$|prototype$|constructor$)[A-Za-z0-9_-]+$',
});
const children = Type.Optional(Type.Array(id, { maxItems: 100 }));
const element = <T extends string, P extends ReturnType<typeof Type.Object>>(
	type: T,
	props: P,
) => Type.Object({ type: Type.Literal(type), props, children }, strict);

/** Static, plain-text catalog. Only Card and Stack may contain children. */
export const displayElementSchema = Type.Union([
	element(
		'Heading',
		Type.Object(
			{
				text,
				level: Type.Optional(
					Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
				),
			},
			strict,
		),
	),
	element('Text', Type.Object({ text }, strict)),
	element('Card', Type.Object({ title: Type.Optional(title) }, strict)),
	element('Stack', Type.Object({}, strict)),
	element(
		'List',
		Type.Object({ items: Type.Array(text, { maxItems: 100 }) }, strict),
	),
	element(
		'Table',
		Type.Object(
			{
				columns: Type.Array(title, { minItems: 1, maxItems: 20 }),
				rows: Type.Array(Type.Array(text, { maxItems: 20 }), { maxItems: 100 }),
			},
			strict,
		),
	),
	element(
		'Metric',
		Type.Object(
			{ label: title, value: text, description: Type.Optional(text) },
			strict,
		),
	),
	element('Divider', Type.Object({}, strict)),
]);

export const displaySpecSchema = Type.Object(
	{
		root: id,
		elements: Type.Record(id, displayElementSchema, {
			minProperties: 1,
			maxProperties: 100,
			additionalProperties: false,
		}),
	},
	strict,
);

/**
 * An element rendered by an extension-contributed catalog. The host cannot
 * know the extension's prop shapes, so it checks only what it can: the tree
 * (below), the JSON budget, and that every prop is plain data. The extension
 * validates its own props when it renders.
 */
const catalogElementSchema = Type.Object(
	{
		type: Type.String({ minLength: 1, maxLength: 64 }),
		props: Type.Record(Type.String({ maxLength: 64 }), Type.Unknown()),
		children,
	},
	strict,
);
export const catalogDisplaySpecSchema = Type.Object(
	{
		root: id,
		elements: Type.Record(id, catalogElementSchema, {
			minProperties: 1,
			maxProperties: 100,
			additionalProperties: false,
		}),
	},
	strict,
);

/** `<extensionId>/<catalogName>`, the key a web extension registers under. */
export const displayCatalogId = Type.String({
	minLength: 3,
	maxLength: 160,
	pattern: '^[a-z0-9][a-z0-9.-]*/[A-Za-z0-9_-]+$',
});

export const displayInputSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Literal('text'),
			prompt: title,
			placeholder: Type.Optional(text),
		},
		strict,
	),
	Type.Object(
		{
			kind: Type.Literal('select'),
			prompt: title,
			options: Type.Array(Type.String({ minLength: 1, maxLength: 200 }), {
				minItems: 1,
				maxItems: 50,
				uniqueItems: true,
			}),
		},
		strict,
	),
	Type.Object(
		{ kind: Type.Literal('confirm'), prompt: title, message: text },
		strict,
	),
]);
export const displayParametersSchema = Type.Object(
	{
		title: Type.Optional(title),
		spec: displaySpecSchema,
		input: Type.Optional(displayInputSchema),
	},
	strict,
);
const envelopeSchema = Type.Union([
	Type.Object(
		{
			version: Type.Literal(1),
			title: Type.Optional(title),
			spec: displaySpecSchema,
		},
		strict,
	),
	Type.Object(
		{
			version: Type.Literal(1),
			title: Type.Optional(title),
			/** Names the extension catalog that renders `spec`. */
			catalog: displayCatalogId,
			spec: catalogDisplaySpecSchema,
		},
		strict,
	),
]);
const responseSchema = Type.Union([
	Type.Object(
		{
			status: Type.Literal('submitted'),
			value: Type.Union([text, Type.Boolean()]),
		},
		strict,
	),
	Type.Object({ status: Type.Literal('cancelled') }, strict),
]);

export type DisplayElement = Static<typeof displayElementSchema>;
export type DisplaySpec = Static<typeof displaySpecSchema>;
export type CatalogDisplaySpec = Static<typeof catalogDisplaySpecSchema>;
export type DisplayInput = Static<typeof displayInputSchema>;
export type DisplayEnvelope = Static<typeof envelopeSchema>;
export type DisplayResponse = Static<typeof responseSchema>;
export type DisplayResult = {
	gizmoDisplay: DisplayEnvelope;
	response?: DisplayResponse;
};

/** Bound work before schema validation; reject non-JSON data, cycles and accessors. */
function boundedJson(value: unknown, budget = 64_000, entries = 10_000) {
	const visit = (item: unknown, depth: number): boolean => {
		if (--entries < 0 || depth > 12) return false;
		if (typeof item === 'string') return (budget -= item.length) >= 0;
		if (item === null || typeof item === 'boolean') return true;
		if (typeof item === 'number') return Number.isFinite(item);
		if (typeof item !== 'object') return false;
		if (
			!Array.isArray(item) &&
			Object.getPrototypeOf(item) !== Object.prototype &&
			Object.getPrototypeOf(item) !== null
		)
			return false;
		for (const key of Object.keys(item)) {
			if ((budget -= key.length) < 0) return false;
			const descriptor = Object.getOwnPropertyDescriptor(item, key);
			if (
				!descriptor ||
				!('value' in descriptor) ||
				!visit(descriptor.value, depth + 1)
			)
				return false;
		}
		return true;
	};
	return visit(value, 0);
}

/** A single rooted tree: no cycles, sharing, missing nodes, or unreachable nodes. */
export function parseDisplaySpec(value: unknown): DisplaySpec | undefined {
	try {
		if (!boundedJson(value) || !Value.Check(displaySpecSchema, value)) return;
		const spec = value as DisplaySpec;
		const wellFormed = (node: DisplayElement) => {
			if (
				node.type !== 'Card' &&
				node.type !== 'Stack' &&
				node.children?.length
			)
				return false;
			return !(
				node.type === 'Table' &&
				node.props.rows.some((row) => row.length !== node.props.columns.length)
			);
		};
		return rootedTree(spec, wellFormed) ? structuredClone(spec) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Like `parseDisplaySpec` for an extension catalog: any element type may
 * have children, since the host does not know which types are containers.
 */
export function parseCatalogDisplaySpec(
	value: unknown,
	validateNode: (
		node: CatalogDisplaySpec['elements'][string],
	) => boolean = () => true,
): CatalogDisplaySpec | undefined {
	try {
		if (!boundedJson(value) || !Value.Check(catalogDisplaySpecSchema, value))
			return;
		const spec = value as CatalogDisplaySpec;
		return rootedTree(spec, validateNode) ? structuredClone(spec) : undefined;
	} catch {
		return undefined;
	}
}

function rootedTree<T extends { children?: string[] }>(
	spec: { root: string; elements: Record<string, T> },
	wellFormed: (node: T) => boolean,
): boolean {
	const seen = new Set<string>();
	const visit = (key: string, depth: number): boolean => {
		if (depth > 16 || seen.has(key) || !Object.hasOwn(spec.elements, key))
			return false;
		seen.add(key);
		const node = spec.elements[key]!;
		if (!wellFormed(node)) return false;
		return (node.children ?? []).every((child) => visit(child, depth + 1));
	};
	return visit(spec.root, 1) && seen.size === Object.keys(spec.elements).length;
}

/** Read tool *details* and return its validated versioned gizmoDisplay envelope. */
export function readDisplayResult(value: unknown): DisplayEnvelope | undefined {
	try {
		// Only the envelope is inspected: an extension tool keeps whatever other
		// details it records for the model or its own result component.
		if (
			value === null ||
			typeof value !== 'object' ||
			!('gizmoDisplay' in value) ||
			!boundedJson((value as DisplayResult).gizmoDisplay, 70_000, 11_000) ||
			!Value.Check(envelopeSchema, (value as DisplayResult).gizmoDisplay) ||
			('response' in value &&
				!Value.Check(
					Type.Optional(responseSchema),
					(value as DisplayResult).response,
				))
		)
			return;
		const envelope = (value as DisplayResult).gizmoDisplay;
		if ('catalog' in envelope) {
			const spec = parseCatalogDisplaySpec(envelope.spec);
			return spec ? { ...envelope, spec } : undefined;
		}
		const spec = parseDisplaySpec(envelope.spec);
		return spec ? { ...envelope, spec } : undefined;
	} catch {
		return undefined;
	}
}
