import type { WebSocket } from 'ws';
import {
	parseRequestMessage,
	sendError,
	sendSuccess,
} from './protocol-messages';
import { routeRequest, type RequestServices } from './request-router';

export async function handleRequestMessage(
	socket: WebSocket,
	services: RequestServices,
	text: string | undefined,
): Promise<void> {
	const parsed = parseRequestMessage(text);
	if (!parsed.ok) {
		sendError(socket, parsed.requestId, 'invalid_request', parsed.error);
		return;
	}

	try {
		const result = await routeRequest(services, parsed.request);
		sendSuccess(socket, parsed.request.requestId, result);
	} catch (error) {
		sendError(socket, parsed.request.requestId, 'request_failed', error);
	}
}
