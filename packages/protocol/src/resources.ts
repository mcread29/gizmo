import { Type, type Static } from 'typebox';

export const resourceScopeSchema = Type.Union([
	Type.Literal('global'),
	Type.Literal('project'),
]);

export type ResourceScope = Static<typeof resourceScopeSchema>;

/**
 * A skill Gizmo knows about. Discovery is global-first: every skill found on
 * disk is installed globally, and enablement is decided separately so a new
 * skill never starts influencing sessions on its own.
 */
export const skillResourceSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 200 }),
		name: Type.String({ minLength: 1, maxLength: 200 }),
		description: Type.String({ maxLength: 2000 }),
		scope: resourceScopeSchema,
		path: Type.String({ minLength: 1 }),
		source: Type.String({ minLength: 1 }),
		/** True when Gizmo can safely edit this Markdown file in place. */
		editable: Type.Optional(Type.Boolean()),
		installed: Type.Boolean(),
		enabledGlobally: Type.Boolean(),
		/** Effective state for the workspace the catalog was requested for. */
		enabled: Type.Boolean(),
		/** Present when the workspace overrides the global enablement. */
		override: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false },
);

export type SkillResource = Static<typeof skillResourceSchema>;

export const piExtensionResourceSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 255 }),
		name: Type.String({ minLength: 1, maxLength: 255 }),
		path: Type.String({ minLength: 1 }),
		enabled: Type.Boolean(),
		kind: Type.Union([Type.Literal('file'), Type.Literal('directory')]),
	},
	{ additionalProperties: false },
);

export type PiExtensionResource = Static<typeof piExtensionResourceSchema>;

export const skillFileSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		content: Type.String({ maxLength: 1_000_000 }),
	},
	{ additionalProperties: false },
);

export type SkillFile = Static<typeof skillFileSchema>;

/** Read-only companion resources: AGENTS.md files and prompt templates. */
export const agentResourceSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 400 }),
		name: Type.String({ minLength: 1, maxLength: 200 }),
		description: Type.Optional(Type.String({ maxLength: 2000 })),
		scope: resourceScopeSchema,
		path: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type AgentResource = Static<typeof agentResourceSchema>;

export const resourceCatalogSchema = Type.Object(
	{
		/** Absolute path of the workspace the effective state was resolved for. */
		workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		skills: Type.Array(skillResourceSchema),
		agentsFiles: Type.Array(agentResourceSchema),
		prompts: Type.Array(agentResourceSchema),
		extensions: Type.Optional(Type.Array(piExtensionResourceSchema)),
		/** Installed Gizmo extensions with their global enablement. */
		gizmoExtensions: Type.Optional(
			Type.Array(
				Type.Object(
					{
						id: Type.String({ minLength: 1, maxLength: 64 }),
						name: Type.String({ minLength: 1, maxLength: 64 }),
						enabled: Type.Boolean(),
					},
					{ additionalProperties: false },
				),
			),
		),
		diagnostics: Type.Array(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type ResourceCatalog = Static<typeof resourceCatalogSchema>;
