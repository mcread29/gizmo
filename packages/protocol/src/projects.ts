import { Type, type Static } from 'typebox';
import { compactionPolicySchema } from './compaction';
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
		/**
		 * Pi extension entry paths (files or directories) loaded only for
		 * this workspace's sessions. Listing a path is the opt-in: Gizmo
		 * offers what it finds in `.gizmo/extensions`, but loads nothing
		 * until it appears here. A path inside the workspace is stored
		 * relative to its root, so a committed config travels with the
		 * repository; anything else is absolute.
		 */
		piExtensionPaths: Type.Optional(
			Type.Array(Type.String({ minLength: 1, maxLength: 1024 })),
		),
		/**
		 * When and how far this workspace's threads compact. Absent means
		 * `defaultCompactionPolicy`; every client of the workspace shares it.
		 */
		compaction: Type.Optional(compactionPolicySchema),
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
		/** Hidden workspaces keep all their data but leave the sidebar list. */
		hidden: Type.Optional(Type.Boolean()),
		addedAt: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type StoredProject = Static<typeof storedProjectSchema>;

export type ProjectSkill = Static<typeof projectSkillSchema>;

/** One entry of a workspace's own `.gizmo/extensions` directory. */
export const workspaceExtensionSchema = Type.Object(
	{
		/** The entry's name on disk, extension included for a lone file. */
		id: Type.String({ minLength: 1, maxLength: 255 }),
		/** Where it is listed from: relative to the workspace root, `/`-separated. */
		path: Type.String({ minLength: 1, maxLength: 1024 }),
	},
	{ additionalProperties: false },
);

export type WorkspaceExtension = Static<typeof workspaceExtensionSchema>;

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
		/**
		 * What `<workspace>/.gizmo/extensions` holds. Listing an entry is
		 * not loading it: an entry runs only once its `path` joins
		 * `config.piExtensionPaths`, which is what the workspace's
		 * Extensions screen switches on and off.
		 */
		workspaceExtensions: Type.Array(workspaceExtensionSchema),
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
