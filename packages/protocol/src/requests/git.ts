import { Type } from 'typebox';
import { envelope } from '../envelopes';

export const gitRequestSchemas = [
	Type.Object(
		{
			...envelope,
			type: Type.Literal('git.commit-message'),
			sessionId: Type.String({ minLength: 1 }),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('file.revert'),
			projectPath: Type.String({ minLength: 1 }),
			file: Type.String({ minLength: 1 }),
			patch: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
] as const;
