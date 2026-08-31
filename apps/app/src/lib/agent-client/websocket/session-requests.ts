import {
	parseAgentModelCatalog,
	parseComposerCommands,
	parseProviderStatuses,
	parseSessionCatalog,
	parseSessionSnapshot,
	parseSessionTree,
	type AgentAttachment,
	type CompactionPolicy,
	type ExtensionUiResponse,
	type SessionOptions,
} from '@gizmo/protocol';
import { RequestClient } from './request-client';
import { parseAttachmentContent } from './response-parsers';

export class SessionRequests extends RequestClient {
	async listProviders() {
		const response = await this.request({ type: 'providers.list' });
		return parseProviderStatuses(response.result);
	}

	async reimportPiAuth() {
		const response = await this.request({
			type: 'providers.import-pi-auth',
		});
		return parseProviderStatuses(response.result);
	}

	async createSession(options: SessionOptions = {}) {
		const response = await this.request({ type: 'session.create', options });
		if (!response.sessionId) {
			throw new Error('Agent server did not return a session ID');
		}
		return response.sessionId;
	}

	async listSessions() {
		const response = await this.request({ type: 'session.list' });
		return parseSessionCatalog(response.result);
	}

	async resumeSession(sessionId: string) {
		const response = await this.request({
			type: 'session.resume',
			sessionId,
		});
		return parseSessionSnapshot(response.result);
	}

	async renameSession(sessionId: string, title: string) {
		await this.request({ type: 'session.rename', sessionId, title });
	}

	async prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments?: AgentAttachment[],
	) {
		await this.request({
			type: 'session.prompt',
			sessionId,
			text,
			compaction,
			attachments,
		});
	}

	async listCommands(sessionId: string) {
		const response = await this.request({
			type: 'session.commands',
			sessionId,
		});
		return parseComposerCommands(response.result);
	}

	async compact(sessionId: string, compaction: CompactionPolicy) {
		await this.request({ type: 'session.compact', sessionId, compaction });
	}

	async reloadSession(sessionId: string) {
		await this.request({ type: 'session.reload', sessionId });
	}

	async steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	) {
		await this.request({
			type: 'session.steer',
			sessionId,
			text,
			attachments,
		});
	}

	async abort(sessionId: string) {
		await this.request({ type: 'session.abort', sessionId });
	}

	async resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		await this.request({
			type: 'extension.ui.respond',
			sessionId,
			runtimeId,
			uiRequestId,
			response,
		});
	}

	async resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	) {
		await this.request({
			type: 'confirmation.resolve',
			sessionId,
			confirmationId,
			accepted,
		});
	}

	async deleteSession(sessionId: string) {
		await this.request({ type: 'session.delete', sessionId });
	}

	async readAttachment(sessionId: string, attachmentId: string) {
		const response = await this.request({
			type: 'attachment.read',
			sessionId,
			attachmentId,
		});
		return parseAttachmentContent(response.result);
	}

	async revealAttachment(sessionId: string, attachmentId: string) {
		await this.request({
			type: 'attachment.reveal',
			sessionId,
			attachmentId,
		});
	}

	async getSessionTree(sessionId: string) {
		const response = await this.request({
			type: 'session.tree',
			sessionId,
		});
		return parseSessionTree(response.result);
	}

	async branchSession(sessionId: string, entryId: string | null) {
		const response = await this.request({
			type: 'session.branch',
			sessionId,
			entryId,
		});
		return parseSessionSnapshot(response.result);
	}

	async labelEntry(sessionId: string, entryId: string, label?: string) {
		const response = await this.request({
			type: 'session.label',
			sessionId,
			entryId,
			...(label === undefined ? {} : { label }),
		});
		return parseSessionTree(response.result);
	}

	async getModelCatalog(sessionId: string) {
		const response = await this.request({
			type: 'model.catalog',
			sessionId,
		});
		return parseAgentModelCatalog(response.result);
	}

	async selectModel(sessionId: string, provider: string, modelId: string) {
		const response = await this.request({
			type: 'model.select',
			sessionId,
			provider,
			modelId,
		});
		return parseAgentModelCatalog(response.result);
	}

	async selectThinkingLevel(sessionId: string, level: string) {
		const response = await this.request({
			type: 'thinking.select',
			sessionId,
			level,
		});
		return parseAgentModelCatalog(response.result);
	}
}
