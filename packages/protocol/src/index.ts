export interface AgentIdentity {
	name: string;
	version: string;
	capabilities: readonly string[];
}

export const protocolVersion = 1;
