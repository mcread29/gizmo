import { Type, type Static } from 'typebox';
import { eventEnvelope } from './envelopes';

/**
 * Where an update stands. `idle` is the resting state; `installing` covers
 * the download, unpack and dependency install, during which the running
 * server keeps serving; `restarting` is sent once, just before the server
 * exits for its supervisor to start the new release; `failed` keeps the
 * running release and carries the reason.
 */
export const appUpdatePhaseSchema = Type.Union([
	Type.Literal('idle'),
	Type.Literal('installing'),
	Type.Literal('restarting'),
	Type.Literal('failed'),
]);

export type AppUpdatePhase = Static<typeof appUpdatePhaseSchema>;

/**
 * The running Gizmo and whether a newer one is published. A `release`
 * install runs a tagged tarball under `~/.gizmo/app/releases`; a `source`
 * install runs a git checkout, where an update is a fast-forward pull of
 * the current branch.
 */
export const appUpdateStatusSchema = Type.Object(
	{
		install: Type.Union([Type.Literal('release'), Type.Literal('source')]),
		/** The tag for a release, the short commit for a source checkout. */
		version: Type.String({ minLength: 1 }),
		/** The tree the server is running from. */
		root: Type.String({ minLength: 1 }),
		/** The newest published tag, or the remote branch tip for a checkout. */
		latest: Type.Optional(Type.String({ minLength: 1 })),
		updateAvailable: Type.Boolean(),
		/** When `latest` was last asked for; absent until the first check. */
		checkedAt: Type.Optional(Type.Integer({ minimum: 0 })),
		/** Why the last check could not say; the rest is still valid. */
		checkError: Type.Optional(Type.String({ minLength: 1 })),
		phase: appUpdatePhaseSchema,
		/** What the update is moving to, while one is under way or has failed. */
		target: Type.Optional(Type.String({ minLength: 1 })),
		/** The failure, or the last line of progress while installing. */
		message: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type AppUpdateStatus = Static<typeof appUpdateStatusSchema>;

/**
 * Broadcast to every connection whenever the status changes, so each tab
 * sees the update progress and the restart notice that precedes the drop.
 */
export const appUpdateChangedEventSchema = Type.Object(
	{
		...eventEnvelope,
		type: Type.Literal('app.update.changed'),
		status: appUpdateStatusSchema,
	},
	{ additionalProperties: false },
);
