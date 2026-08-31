import { Type } from 'typebox';
import { protocolVersion } from './core';

export const envelope = {
	protocolVersion: Type.Literal(protocolVersion),
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
