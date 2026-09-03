import type { AgentClient } from './AgentClient';
import { GitRequests } from './websocket/git-requests';
import { WebSocketTransport } from './websocket/transport';

export interface WebSocketAgentClientOptions {
	url?: string;
	createSocket?: (url: string) => WebSocket;
}

export class WebSocketAgentClient extends GitRequests implements AgentClient {
	constructor(options: WebSocketAgentClientOptions = {}) {
		const url = options.url ?? defaultAgentUrl();
		const createSocket = options.createSocket ?? ((url) => new WebSocket(url));
		super(new WebSocketTransport(url, createSocket));
	}

	connect() {
		return this.transport.connect();
	}

	/** Takes effect on the next connect; the current socket is left alone. */
	setEndpoint(url: string) {
		this.transport.setEndpoint(url || defaultAgentUrl());
	}

	disconnect() {
		return this.transport.disconnect();
	}

	subscribe(listener: Parameters<AgentClient['subscribe']>[0]) {
		return this.transport.subscribe(listener);
	}

	subscribeDisconnect(
		listener: Parameters<AgentClient['subscribeDisconnect']>[0],
	) {
		return this.transport.subscribeDisconnect(listener);
	}
}

function defaultAgentUrl() {
	const url = new URL('/agent', window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.href;
}
