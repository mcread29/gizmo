import type { AgentRequest } from '@gizmo/protocol';
import type { PiAgentService } from '../sessions/pi-agent-service';
import type { RouteResult } from './request-router';

type SessionRequestType =
	| 'providers.list'
	| 'providers.import-pi-auth'
	| 'attachment.read'
	| 'attachment.reveal'
	| 'session.list'
	| 'session.create'
	| 'session.resume'
	| 'session.rename'
	| 'session.prompt'
	| 'session.commands'
	| 'session.compact'
	| 'session.reload'
	| 'session.steer'
	| 'session.abort'
	| 'extension.ui.respond'
	| 'confirmation.resolve'
	| 'session.tree'
	| 'session.branch'
	| 'session.label'
	| 'session.delete'
	| 'model.catalog'
	| 'model.select'
	| 'thinking.select';

type SessionRequest = Extract<AgentRequest, { type: SessionRequestType }>;

export async function handleSessionRequest(
	service: PiAgentService,
	request: SessionRequest,
): Promise<RouteResult> {
	switch (request.type) {
		case 'providers.list':
			return { result: await service.listProviders() };
		case 'providers.import-pi-auth':
			return { result: await service.reimportPiAuth() };
		case 'attachment.read':
			return {
				result: await service.readAttachment(
					request.sessionId,
					request.attachmentId,
				),
			};
		case 'attachment.reveal':
			await service.revealAttachment(request.sessionId, request.attachmentId);
			return {};
		case 'session.list':
			return { result: await service.listSessions() };
		case 'session.create':
			return { sessionId: await service.createSession(request.options) };
		case 'session.resume':
			return {
				sessionId: request.sessionId,
				result: await service.resumeSession(request.sessionId),
			};
		case 'session.rename':
			await service.renameSession(request.sessionId, request.title);
			return {};
		case 'session.prompt':
			await service.prompt(
				request.sessionId,
				request.text,
				request.compaction,
				request.attachments,
			);
			return {};
		case 'session.commands':
			return { result: await service.getCommands(request.sessionId) };
		case 'session.compact':
			await service.compact(request.sessionId, request.compaction);
			return {};
		case 'session.reload':
			await service.reloadSession(request.sessionId);
			return {};
		case 'session.steer':
			await service.steer(request.sessionId, request.text, request.attachments);
			return {};
		case 'session.abort':
			await service.abort(request.sessionId);
			return {};
		case 'extension.ui.respond':
			await service.resolveExtensionUi(
				request.sessionId,
				request.runtimeId,
				request.uiRequestId,
				request.response,
			);
			return {};
		case 'confirmation.resolve':
			service.resolveConfirmation(
				request.sessionId,
				request.confirmationId,
				request.accepted,
			);
			return {};
		case 'session.tree':
			return { result: await service.getTree(request.sessionId) };
		case 'session.branch':
			return {
				sessionId: request.sessionId,
				result: await service.branchSession(request.sessionId, request.entryId),
			};
		case 'session.label':
			return {
				result: await service.labelEntry(
					request.sessionId,
					request.entryId,
					request.label,
				),
			};
		case 'session.delete':
			await service.deleteSession(request.sessionId);
			return {};
		case 'model.catalog':
			return { result: await service.getModelCatalog(request.sessionId) };
		case 'model.select':
			return {
				result: await service.selectModel(
					request.sessionId,
					request.provider,
					request.modelId,
				),
			};
		case 'thinking.select':
			return {
				result: await service.selectThinkingLevel(
					request.sessionId,
					request.level,
				),
			};
	}
}
