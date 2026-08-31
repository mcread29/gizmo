import { Type, type Static } from 'typebox';

export const providerStatusSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		authenticated: Type.Boolean(),
		source: Type.Optional(Type.String({ minLength: 1 })),
		credentialType: Type.Optional(
			Type.Union([Type.Literal('api_key'), Type.Literal('oauth')]),
		),
		supportsApiKey: Type.Boolean(),
		supportsOAuth: Type.Boolean(),
		modelCount: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type ProviderStatus = Static<typeof providerStatusSchema>;

export const composerCommandSchema = Type.Object(
	{
		name: Type.String({ minLength: 1 }),
		description: Type.Optional(Type.String()),
		source: Type.Union([
			Type.Literal('extension'),
			Type.Literal('prompt'),
			Type.Literal('skill'),
		]),
	},
	{ additionalProperties: false },
);

export type ComposerCommand = Static<typeof composerCommandSchema>;
