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
const envelopeSchema = Type.Object(
	{
		version: Type.Literal(1),
		title: Type.Optional(title),
		spec: displaySpecSchema,
	},
	strict,
);
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
		const seen = new Set<string>();
		const visit = (key: string, depth: number): boolean => {
			if (depth > 16 || seen.has(key) || !Object.hasOwn(spec.elements, key))
				return false;
			seen.add(key);
			const node = spec.elements[key]!;
			if (
				node.type !== 'Card' &&
				node.type !== 'Stack' &&
				node.children?.length
			)
				return false;
			if (
				node.type === 'Table' &&
				node.props.rows.some((row) => row.length !== node.props.columns.length)
			)
				return false;
			return (node.children ?? []).every((child) => visit(child, depth + 1));
		};
		if (!visit(spec.root, 1) || seen.size !== Object.keys(spec.elements).length)
			return;
		return structuredClone(spec);
	} catch {
		return undefined;
	}
}

/** Read tool *details* and return its validated versioned gizmoDisplay envelope. */
export function readDisplayResult(value: unknown): DisplayEnvelope | undefined {
	try {
		if (
			!boundedJson(value, 70_000, 11_000) ||
			!Value.Check(
				Type.Object(
					{
						gizmoDisplay: envelopeSchema,
						response: Type.Optional(responseSchema),
					},
					strict,
				),
				value,
			)
		)
			return;
		const details = value as DisplayResult;
		const spec = parseDisplaySpec(details.gizmoDisplay.spec);
		if (!spec) return;
		return { ...details.gizmoDisplay, spec };
	} catch {
		return undefined;
	}
}
