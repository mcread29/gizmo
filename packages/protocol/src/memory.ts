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

/**
 * What one scope runs under and why: the effective settings, the default they
 * fall back to, and the override itself when there is one.
 *
 * Sent for a workspace or, with no override, for the machine's own default.
 * The raw override is what lets the UI say which half of a setting is
 * inherited and which was chosen here — a merged view cannot tell a workspace
 * that happens to match the default from one that pinned the same value.
 */
export const digestScopeSchema = Type.Object(
	{
		settings: digestSettingsSchema,
		defaults: digestSettingsSchema,
		override: Type.Optional(digestOverrideSchema),
	},
	{ additionalProperties: false },
);

export type DigestScope = Static<typeof digestScopeSchema>;

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
 * One statement that currently holds, with the segment it came from. Facts
 * that have been superseded are kept on disk but never sent: the client only
 * ever sees the standing set.
 */
export const journalFactSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		segment: Type.String({ minLength: 1 }),
		at: Type.String(),
		subject: Type.String(),
		statement: Type.String(),
		supersedes: Type.Array(Type.String()),
	},
	{ additionalProperties: false },
);

export type JournalFact = Static<typeof journalFactSchema>;

/**
 * How much of a project's journal has been digested. The Memory page shows
 * this to make the derived layer's completeness visible, since a partial
 * layer silently weakens search rather than failing.
 */
export const memoryStatusSchema = Type.Object(
	{
		segments: Type.Integer({ minimum: 0 }),
		digested: Type.Integer({ minimum: 0 }),
		/** How many facts currently stand, after supersession. */
		facts: Type.Integer({ minimum: 0 }),
		/** Segments whose facts have been derived, which trails `digested`. */
		factSegments: Type.Integer({ minimum: 0 }),
		/** What this workspace actually runs under, after any override. */
		settings: digestSettingsSchema,
		/** The default it falls back to, so the UI can name what is inherited. */
		defaults: digestSettingsSchema,
		/** Absent while this workspace inherits the default in full. */
		override: Type.Optional(digestOverrideSchema),
		/** Present while a backfill is running in this workspace. */
		running: Type.Optional(
			Type.Object(
				{
					done: Type.Integer({ minimum: 0 }),
					total: Type.Integer({ minimum: 0 }),
					failed: Type.Integer({ minimum: 0 }),
					/**
					 * Which tier is being built. A run does digests first and facts
					 * second, and the counts restart between them, so without this
					 * the progress bar appears to jump backwards.
					 */
					phase: Type.Union([Type.Literal('digests'), Type.Literal('facts')]),
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
