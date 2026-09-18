import type { AgentRequest } from '@gizmo/protocol';
import type { MemoryService } from '../memory/memory-service';
import type { RouteResult } from './request-router';

type MemoryRequestType =
	| 'memory.status'
	| 'memory.digests'
	| 'memory.settings.set'
	| 'memory.backfill.start'
	| 'memory.backfill.stop';

type MemoryRequest = Extract<AgentRequest, { type: MemoryRequestType }>;

export async function handleMemoryRequest(
	memory: MemoryService,
	request: MemoryRequest,
): Promise<RouteResult> {
	switch (request.type) {
		case 'memory.status':
			return { result: await memory.status(request.projectPath) };
		case 'memory.digests':
			return {
				result: await memory.digests(
					request.projectPath,
					request.query,
					request.limit,
				),
			};
		case 'memory.settings.set':
			return { result: await memory.writeSettings(request.settings) };
		case 'memory.backfill.start':
			return {
				result: await memory.startBackfill(
					request.projectPath,
					request.regenerate,
				),
			};
		case 'memory.backfill.stop':
			return { result: await memory.stopBackfill(request.projectPath) };
	}
}
