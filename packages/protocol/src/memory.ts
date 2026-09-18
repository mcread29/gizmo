import { Type, type Static } from 'typebox';

/** Which model writes journal digests. */
export const digestModelRefSchema = Type.Object(
	{
		provider: Type.String({ minLength: 1 }),
		id: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type DigestModelRef = Static<typeof digestModelRefSchema>;

export const digestSettingsSchema = Type.Object(
	{
		/** Digest each segment as it is journaled. */
		auto: Type.Boolean(),
		/** Absent until a model is chosen; nothing is digested without one. */
		model: Type.Optional(digestModelRefSchema),
	},
	{ additionalProperties: false },
);

export type DigestSettings = Static<typeof digestSettingsSchema>;

/**
 * What one workspace overrides. `model` is nullable rather than merely
 * optional because absent means "inherit the default" while null means
 * "digesting is off in this workspace" — two different intentions that an
 * optional alone cannot tell apart.
 */
export const digestOverrideSchema = Type.Object(
	{
		auto: Type.Optional(Type.Boolean()),
		model: Type.Optional(Type.Union([digestModelRefSchema, Type.Null()])),
	},
	{ additionalProperties: false },
);

export type DigestOverride = Static<typeof digestOverrideSchema>;

export const journalDigestSchema = Type.Object(
	{
		segment: Type.String({ minLength: 1 }),
		at: Type.String(),
		model: Type.String(),
		summary: Type.String(),
		decisions: Type.Array(Type.String()),
		files: Type.Array(Type.String()),
		errors: Type.Array(Type.String()),
		outcome: Type.String(),
	},
	{ additionalProperties: false },
);

export type JournalDigest = Static<typeof journalDigestSchema>;

/**
 * How much of a project's journal has been digested. The Memory page shows
 * this to make the derived layer's completeness visible, since a partial
 * layer silently weakens search rather than failing.
 */
export const memoryStatusSchema = Type.Object(
	{
		segments: Type.Integer({ minimum: 0 }),
		digested: Type.Integer({ minimum: 0 }),
		/** What this workspace actually runs under, after any override. */
		settings: digestSettingsSchema,
		/** The default it falls back to, so the UI can name what is inherited. */
		defaults: digestSettingsSchema,
		/** True when this workspace overrides the default rather than inheriting. */
		overridden: Type.Boolean(),
		/** Present while a backfill is running in this workspace. */
		running: Type.Optional(
			Type.Object(
				{
					done: Type.Integer({ minimum: 0 }),
					total: Type.Integer({ minimum: 0 }),
					failed: Type.Integer({ minimum: 0 }),
					/** Why the most recent failure failed, when one has. */
					error: Type.Optional(Type.String()),
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);

export type MemoryStatus = Static<typeof memoryStatusSchema>;
