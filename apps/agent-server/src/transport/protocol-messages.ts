import {
	parseAgentRequest,
	protocolVersion,
	type AgentRequest,
	type AgentResponse,
} from '@gizmo/protocol';
import { WebSocket } from 'ws';

export type ParsedRequestMessage =
	| { ok: true; request: AgentRequest }
	| { ok: false; requestId: string; error: unknown };

export function parseRequestMessage(
	text: string | undefined,
): ParsedRequestMessage {
	let input: unknown;
	try {
		if (text === undefined)
			throw new Error('Binary messages are not supported');
		input = JSON.parse(text);
		return { ok: true, request: parseAgentRequest(input) };
	} catch (error) {
		return {
			ok: false,
			requestId: getRequestId(input) ?? 'unknown',
			error,
		};
	}
}

export function sendMessage(socket: WebSocket, value: unknown): void {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

export function sendSuccess(
	socket: WebSocket,
	requestId: string,
	result: { sessionId?: string; result?: unknown },
): void {
	sendMessage(socket, {
		protocolVersion,
		requestId,
		type: 'response.success',
		...result,
	} satisfies AgentResponse);
}

export function sendError(
	socket: WebSocket,
	requestId: string,
	code: string,
	error: unknown,
): void {
	sendMessage(socket, {
		protocolVersion,
		requestId,
		type: 'response.error',
		code,
		message: error instanceof Error ? error.message : String(error),
	} satisfies AgentResponse);
}

function getRequestId(input: unknown): string | undefined {
	if (!input || typeof input !== 'object' || !('requestId' in input)) return;
	return typeof input.requestId === 'string' && input.requestId
		? input.requestId
		: undefined;
}
