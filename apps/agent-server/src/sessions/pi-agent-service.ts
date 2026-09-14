/**
 * The agent service's command surface, assembled from the layers in
 * `pi-agent-service-core.ts`, `-resources.ts`, `-projects.ts`, and
 * `-sessions.ts`. Split so no layer exceeds the file-length budget; the
 * public API — every method and the wire handlers that call them — is
 * unchanged.
 */
export { PiAgentServiceSessions as PiAgentService } from './pi-agent-service-sessions';

export type {
	AgentEventListener,
	PiAgentServiceOptions,
	PiSessionCallbacks,
} from './pi-agent-types';
export type { PiSessionFactory, PiSessionLike } from './pi-agent-types';
