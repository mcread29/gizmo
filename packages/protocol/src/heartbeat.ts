import { Type, type Static } from 'typebox';
import { protocolVersion } from './core';

/**
 * Sent by the server on a fixed cadence over every connection. It is not an
 * event: it carries no session and no event id of its own. `lastEventId` is
 * the id of the newest event the server has emitted, so a client that heard
 * nothing for a while can tell a quiet server from a socket that lost events.
 */
export const heartbeatSchema = Type.Object(
	{
		protocolVersion: Type.Literal(protocolVersion),
		type: Type.Literal('heartbeat'),
		lastEventId: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type Heartbeat = Static<typeof heartbeatSchema>;

/** How often the server sends one; clients wait several before giving up. */
export const heartbeatIntervalMs = 15_000;
