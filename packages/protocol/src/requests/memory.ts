import { Type } from 'typebox';
import { envelope } from '../envelopes';
import { digestOverrideSchema, digestSettingsSchema } from '../memory';

export const memoryRequestSchemas = [
	/** Coverage and settings for one workspace's journal. */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('memory.status'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	/** The saved memories themselves, newest segment first. */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('memory.digests'),
			projectPath: Type.String({ minLength: 1 }),
			/** Free-text filter over summaries, decisions and errors. */
			query: Type.Optional(Type.String({ maxLength: 500 })),
			limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
		},
		{ additionalProperties: false },
	),
	/**
	 * Writes either the default or one workspace's override. An override with
	 * no keys clears it, so the workspace inherits the default again.
	 */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('memory.settings.set'),
			/** Absent writes the default; present writes that workspace's override. */
			projectPath: Type.Optional(Type.String({ minLength: 1 })),
			settings: Type.Optional(digestSettingsSchema),
			override: Type.Optional(digestOverrideSchema),
			/** Clears the workspace's override so it inherits again. */
			inherit: Type.Optional(Type.Boolean()),
		},
		{ additionalProperties: false },
	),
	/**
	 * Digests every segment that has none. Safe to call twice: a second run
	 * skips what the first finished.
	 */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('memory.backfill.start'),
			projectPath: Type.String({ minLength: 1 }),
			/** Re-digest segments that already have one, e.g. on a better model. */
			regenerate: Type.Optional(Type.Boolean()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('memory.backfill.stop'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
] as const;
