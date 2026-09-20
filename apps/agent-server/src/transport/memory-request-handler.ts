import type { AgentRequest } from '@gizmo/protocol';
import type { MemoryService } from '../memory/memory-service';
import type { RouteResult } from './request-router';

type MemoryRequestType =
	| 'memory.status'
	| 'memory.digests'
	| 'memory.facts'
	| 'memory.settings'
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
		case 'memory.facts':
			return { result: await memory.facts(request.projectPath) };
		case 'memory.settings':
			return { result: await memory.settingsScope(request.projectPath) };
		case 'memory.settings.set': {
			// No project means the default; a project means its override, which
			// `inherit` clears so the workspace falls back to the default again.
			if (!request.projectPath) {
				if (!request.settings) {
					throw new Error('Writing the default needs settings');
				}
				return { result: await memory.writeDefaults(request.settings) };
			}
			return {
				result: await memory.writeOverride(
					request.projectPath,
					request.inherit ? undefined : (request.override ?? {}),
				),
			};
		}
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
