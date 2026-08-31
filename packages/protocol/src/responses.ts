import { Type, type Static } from 'typebox';
import { responseEnvelope } from './envelopes';

export const agentResponseSchema = Type.Union([
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.success'),
			sessionId: Type.Optional(Type.String({ minLength: 1 })),
			result: Type.Optional(Type.Unknown()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.error'),
			code: Type.String({ minLength: 1 }),
			message: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
]);

export type AgentResponse = Static<typeof agentResponseSchema>;
