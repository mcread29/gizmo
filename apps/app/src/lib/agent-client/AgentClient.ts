import type { SessionOptions } from '@unity-agent/protocol';

export type AgentEventListener = (event: unknown) => void;
export type AgentDisconnectListener = (error: Error) => void;

export interface AgentClient {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	createSession(options?: SessionOptions): Promise<string>;
	prompt(sessionId: string, text: string): Promise<void>;
	steer(sessionId: string, text: string): Promise<void>;
	abort(sessionId: string): Promise<void>;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
