import { Type, type Static } from 'typebox';
import { agentModelOptionSchema } from './sessions';

/**
 * The model catalog with no session in play, served by `models.catalog` for
 * global settings such as an extension's `model` field.
 */
export const globalModelCatalogSchema = Type.Object(
	{
		models: Type.Array(agentModelOptionSchema),
		thinkingLevels: Type.Array(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type GlobalModelCatalog = Static<typeof globalModelCatalogSchema>;
