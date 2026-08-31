import { Type, type Static } from 'typebox';

export const extensionOperationSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		mutates: Type.Boolean(),
		requiresConfirmation: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export type ExtensionOperation = Static<typeof extensionOperationSchema>;

export const extensionDescriptorSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		name: Type.String({ minLength: 1, maxLength: 128 }),
		version: Type.String({ minLength: 1, maxLength: 64 }),
		apiVersion: Type.Integer({ minimum: 1 }),
		capabilities: Type.Array(Type.String({ minLength: 1, maxLength: 128 })),
		operations: Type.Array(extensionOperationSchema),
	},
	{ additionalProperties: false },
);

export type ExtensionDescriptor = Static<typeof extensionDescriptorSchema>;

export const extensionsSchema = Type.Object(
	{
		extensions: Type.Array(extensionDescriptorSchema),
	},
	{ additionalProperties: false },
);

export type Extensions = Static<typeof extensionsSchema>;

/**
 * One runtime-loadable web extension bundle. `code` is a standalone ES module
 * exporting `gizmoWebExtension`; the app imports it through a real runtime
 * `import()` of a blob URL, which its own bundler never had to resolve.
 */
export const webExtensionBundleSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		code: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type WebExtensionBundle = Static<typeof webExtensionBundleSchema>;

export const webExtensionBundlesSchema = Type.Object(
	{
		bundles: Type.Array(webExtensionBundleSchema),
		/** Extensions that declared a web bundle Gizmo could not load. */
		diagnostics: Type.Array(Type.String()),
	},
	{ additionalProperties: false },
);

export type WebExtensionBundles = Static<typeof webExtensionBundlesSchema>;

export const extensionUiRequestSchema = Type.Union([
	Type.Object(
		{
			method: Type.Literal('select'),
			title: Type.String({ maxLength: 500 }),
			options: Type.Array(Type.String({ maxLength: 2_000 }), {
				minItems: 0,
				maxItems: 500,
			}),
			timeout: Type.Optional(Type.Integer({ minimum: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('confirm'),
			title: Type.String({ maxLength: 500 }),
			message: Type.String({ maxLength: 10_000 }),
			timeout: Type.Optional(Type.Integer({ minimum: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('input'),
			title: Type.String({ maxLength: 500 }),
			placeholder: Type.Optional(Type.String({ maxLength: 2_000 })),
			timeout: Type.Optional(Type.Integer({ minimum: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('editor'),
			title: Type.String({ maxLength: 500 }),
			prefill: Type.Optional(Type.String({ maxLength: 100_000 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('notify'),
			message: Type.String({ maxLength: 10_000 }),
			notificationType: Type.Union([
				Type.Literal('info'),
				Type.Literal('warning'),
				Type.Literal('error'),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setStatus'),
			key: Type.String({ minLength: 1, maxLength: 200 }),
			text: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setWorkingMessage'),
			message: Type.Union([Type.String({ maxLength: 2_000 }), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setWorkingVisible'),
			visible: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setWorkingIndicator'),
			frames: Type.Union([
				Type.Array(Type.String({ maxLength: 200 }), { maxItems: 100 }),
				Type.Null(),
			]),
			intervalMs: Type.Optional(Type.Integer({ minimum: 16, maximum: 60_000 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setWidget'),
			key: Type.String({ minLength: 1, maxLength: 200 }),
			lines: Type.Union([
				Type.Array(Type.String({ maxLength: 5_000 }), { maxItems: 200 }),
				Type.Null(),
			]),
			placement: Type.Union([
				Type.Literal('aboveEditor'),
				Type.Literal('belowEditor'),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setTitle'),
			title: Type.String({ maxLength: 1_000 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			method: Type.Literal('setEditorText'),
			text: Type.String({ maxLength: 100_000 }),
		},
		{ additionalProperties: false },
	),
]);

export type ExtensionUiRequest = Static<typeof extensionUiRequestSchema>;

export const extensionUiResponseSchema = Type.Union([
	Type.Object(
		{ kind: Type.Literal('value'), value: Type.String({ maxLength: 100_000 }) },
		{ additionalProperties: false },
	),
	Type.Object(
		{ kind: Type.Literal('confirmed'), confirmed: Type.Boolean() },
		{ additionalProperties: false },
	),
	Type.Object(
		{ kind: Type.Literal('cancelled') },
		{ additionalProperties: false },
	),
]);

export type ExtensionUiResponse = Static<typeof extensionUiResponseSchema>;
