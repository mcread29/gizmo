import type { AgentRequest } from '@gizmo/protocol';
import { appUpdates } from '../updates/app-update-service';
import type { RouteResult } from './request-router';

type AppRequestType = 'app.update.status' | 'app.update.start';

type AppRequest = Extract<AgentRequest, { type: AppRequestType }>;

export async function handleAppRequest(
	request: AppRequest,
): Promise<RouteResult> {
	switch (request.type) {
		case 'app.update.status':
			return { result: await appUpdates.status(request.refresh ?? false) };
		case 'app.update.start':
			return { result: await appUpdates.start(request.version) };
	}
}
