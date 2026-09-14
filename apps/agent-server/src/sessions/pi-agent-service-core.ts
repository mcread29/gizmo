import { ProjectCatalog } from '../projects/project-catalog';
import { ResourceCatalogService } from '../resources/resource-catalog';
import { AgentEventHub } from './agent-event-hub';
import type {
	AgentEventListener,
	PiAgentServiceOptions,
} from './pi-agent-types';
import { createDefaultPiSession } from './pi-session-factory';
import type { PiSessionFactory } from './pi-agent-types';
import { SessionCatalogService } from './session-catalog-service';
import { SessionOperations } from './session-operations';
import {
	PiSessionRepository,
	type SessionRepository,
} from './session-repository';
import { SessionRuntimePool } from './session-runtime-pool';
import { ToolPolicyService } from './tool-policy-service';

/**
 * The state every command group of `PiAgentService` shares. Declared
 * `protected` because the facade is split across an inheritance chain
 * (`pi-agent-service-*.ts`) and `#private` fields cannot cross files.
 */
export interface ServiceContext {
	readonly events: AgentEventHub;
	readonly pool: SessionRuntimePool;
	readonly catalog: SessionCatalogService;
	readonly operations: SessionOperations;
	readonly projects: ProjectCatalog;
	readonly resources: ResourceCatalogService;
	readonly toolPolicy: ToolPolicyService;
}

/**
 * Wires the capabilities together. Subclasses in `pi-agent-service-*.ts`
 * layer command groups on top; `pi-agent-service.ts` exports the final class.
 */
export class PiAgentServiceCore {
	protected readonly context: ServiceContext;

	constructor(
		factory: PiSessionFactory = createDefaultPiSession,
		repository: SessionRepository = new PiSessionRepository(),
		projects: ProjectCatalog = new ProjectCatalog(),
		resources: ResourceCatalogService = new ResourceCatalogService(projects),
		options: PiAgentServiceOptions = {},
	) {
		const events = new AgentEventHub();
		const pool = new SessionRuntimePool(events, options);
		const catalog = new SessionCatalogService(
			factory,
			repository,
			projects,
			pool,
		);
		const operations = new SessionOperations(catalog, pool, repository);
		this.context = {
			events,
			pool,
			catalog,
			operations,
			projects,
			resources,
			toolPolicy: new ToolPolicyService(),
		};
	}

	subscribe(listener: AgentEventListener) {
		return this.context.events.subscribe(listener);
	}

	get events() {
		return this.context.events;
	}

	resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	) {
		this.context.pool.resolveConfirmation(sessionId, confirmationId, accepted);
	}

	abortStreamingSessions() {
		return this.context.pool.abortStreamingSessions();
	}

	async dispose() {
		// Awaited so the journal flushes finish before the process tears down.
		await this.context.pool.dispose();
		this.context.events.clear();
	}
}
