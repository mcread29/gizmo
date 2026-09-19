import { Type } from 'typebox';

export const strict = { additionalProperties: false };
export const identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern:
		'^(?!__proto__$|prototype$|constructor$)[A-Za-z0-9][A-Za-z0-9._:/-]*$',
});
export const label = Type.String({ maxLength: 500 });
export const webUrl = Type.String({ pattern: '^https?://', maxLength: 2000 });
export const text = Type.String({ maxLength: 20_000 });
export const path = Type.String({ minLength: 1, maxLength: 4_096 });
