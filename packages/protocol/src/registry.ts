import { Type, type Static } from 'typebox';

export const registryCatalogEntrySchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		description: Type.Optional(Type.String()),
		linked: Type.Boolean(),
		/** Present when the extension is linked into the Pi extensions dir. */
		entry: Type.Optional(Type.String({ minLength: 1 })),
		web: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type RegistryCatalogEntry = Static<typeof registryCatalogEntrySchema>;

export const registryInfoSchema = Type.Object(
	{
		name: Type.String({ minLength: 1 }),
		url: Type.String({ minLength: 1 }),
		commit: Type.Optional(Type.String()),
		addedAt: Type.Integer({ minimum: 0 }),
		extensions: Type.Array(registryCatalogEntrySchema),
	},
	{ additionalProperties: false },
);

export type RegistryInfo = Static<typeof registryInfoSchema>;

export const registryStatusSchema = Type.Object(
	{
		home: Type.String({ minLength: 1 }),
		registries: Type.Array(registryInfoSchema),
	},
	{ additionalProperties: false },
);

export type RegistryStatus = Static<typeof registryStatusSchema>;
