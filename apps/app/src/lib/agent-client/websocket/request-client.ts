import type { AgentRequestBody, WebSocketTransport } from './transport';

export class RequestClient {
	constructor(protected readonly transport: WebSocketTransport) {}

	protected request(body: AgentRequestBody) {
		return this.transport.request(body);
	}
}
