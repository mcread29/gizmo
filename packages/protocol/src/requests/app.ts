import { Type } from 'typebox';
import { envelope } from '../envelopes';

export const appRequestSchemas = [
	/** The running version and, unless the last check is recent, the latest. */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('app.update.status'),
			/** Ask the release source again even if the last check is recent. */
			refresh: Type.Optional(Type.Boolean()),
		},
		{ additionalProperties: false },
	),
	/**
	 * Installs the latest release (or a named tag) beside the running one and
	 * restarts. Returns as soon as the update is under way; progress arrives
	 * as `app.update.changed` events.
	 */
	Type.Object(
		{
			...envelope,
			type: Type.Literal('app.update.start'),
			version: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
		},
		{ additionalProperties: false },
	),
] as const;
