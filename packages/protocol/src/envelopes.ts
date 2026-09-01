import { Type } from 'typebox';
import { protocolVersion } from './core';

export const envelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};

/**
 * v25 compatibility: project.status/project.open/project.watch requests from
 * a v25 client carry no extensionId and are stamped with version 25. Accepted
 * only for the migration window; remove together with the v25 request
 * variants in `requests/project.ts`.
 */
export const v25Envelope = {
	protocolVersion: Type.Literal(25),
	requestId: Type.String({ minLength: 1 }),
};

export const eventEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	eventId: Type.Integer({ minimum: 1 }),
	sessionId: Type.String({ minLength: 1 }),
};

export const responseEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};
