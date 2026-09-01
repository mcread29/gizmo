import { Type, type Static } from 'typebox';
import { workspaceProfileExtensionSchema } from './sessions';

export const projectSkillSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 200 }),
		enabled: Type.Boolean(),
	},
	{ additionalProperties: false },
);

/** One extension enablement override; absent entries inherit the global state. */
const extensionOverrideSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 255 }),
		enabled: Type.Boolean(),
	},
	{ additionalProperties: false },
);

/**
 * Project-scoped configuration: only the departures from the global settings
 * live here. Every section is optional, and an empty file means the project
 * inherits everything global — Gizmo extensions, Pi extensions, skills, and
 * the global built-in tool policy.
 */
export const projectConfigSchema = Type.Object(
	{
		version: Type.Literal(1),
		gizmoExtensions: Type.Optional(Type.Array(extensionOverrideSchema)),
		piExtensions: Type.Optional(Type.Array(extensionOverrideSchema)),
		/** Overrides of each skill's global enablement. */
		skills: Type.Optional(Type.Array(projectSkillSchema)),
	},
	{ additionalProperties: false },
);

export type ProjectConfig = Static<typeof projectConfigSchema>;

export type ExtensionOverride = Static<typeof extensionOverrideSchema>;

export const storedProjectSchema = Type.Object(
	{
		title: Type.String({ minLength: 1 }),
		path: Type.String({ minLength: 1 }),
		/** Gizmo extensions effectively enabled for new sessions. */
		integrations: Type.Array(workspaceProfileExtensionSchema),
		/** Skill overrides in effect; absent rows follow the global setting. */
		skills: Type.Optional(Type.Array(projectSkillSchema)),
		addedAt: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type StoredProject = Static<typeof storedProjectSchema>;

export type ProjectSkill = Static<typeof projectSkillSchema>;

export const projectDomainsSchema = Type.Object(
	{
		domains: Type.Array(
			Type.Object(
				{
					id: Type.String({ minLength: 1, maxLength: 64 }),
					name: Type.String({ minLength: 1, maxLength: 64 }),
					root: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
		/** The project's stored overrides, if any. */
		config: Type.Optional(projectConfigSchema),
	},
	{ additionalProperties: false },
);

export type ProjectDomains = Static<typeof projectDomainsSchema>;

export const workspaceDirectoryListingSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		parent: Type.Optional(Type.String({ minLength: 1 })),
		directories: Type.Array(
			Type.Object(
				{
					name: Type.String({ minLength: 1 }),
					path: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);

export type WorkspaceDirectoryListing = Static<
	typeof workspaceDirectoryListingSchema
>;
