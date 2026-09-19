import { Type, type Static } from 'typebox';

export const registryCatalogEntrySchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		description: Type.Optional(Type.String()),
		linked: Type.Boolean(),
		/** Present when the extension is linked into the Pi extensions dir. */
		entry: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type RegistryCatalogEntry = Static<typeof registryCatalogEntrySchema>;

/**
 * The one extension registry: Gizmo's own `gizmo-registry` repository, cloned
 * and built in Gizmo-managed storage. Every extension Gizmo can install comes
 * from here.
 */
export const registryStatusSchema = Type.Object(
	{
		/** The managed clone directory. */
		home: Type.String({ minLength: 1 }),
		url: Type.String({ minLength: 1 }),
		commit: Type.Optional(Type.String()),
		/** True when the registry source's HEAD differs from the managed clone. */
		updateAvailable: Type.Optional(Type.Boolean()),
		extensions: Type.Array(registryCatalogEntrySchema),
	},
	{ additionalProperties: false },
);

export type RegistryStatus = Static<typeof registryStatusSchema>;
