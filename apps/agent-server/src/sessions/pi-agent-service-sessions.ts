import type {
	AgentAttachment,
	CompactionPolicy,
	ExtensionUiResponse,
	SessionOptions,
} from '@gizmo/protocol';
import { PiAgentServiceProjects } from './pi-agent-service-projects';

/** Session lifecycle and conversation commands. */
export class PiAgentServiceSessions extends PiAgentServiceProjects {
	createSession(options: SessionOptions = {}) {
		return this.context.catalog.createSession(options);
	}

	listSessions() {
		return this.context.catalog.listSessions();
	}

	resumeSession(sessionId: string) {
		return this.context.catalog.resumeSession(sessionId);
	}

	readSession(sessionId: string) {
		return this.context.catalog.readSession(sessionId);
	}

	renameSession(sessionId: string, title: string) {
		return this.context.operations.renameSession(sessionId, title);
	}

	prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments: AgentAttachment[] = [],
	) {
		return this.context.operations.prompt(
			sessionId,
			text,
			compaction,
			attachments,
		);
	}

	compact(sessionId: string, policy: CompactionPolicy) {
		return this.context.operations.compact(sessionId, policy);
	}

	reloadSession(sessionId: string) {
		return this.context.operations.reloadSession(sessionId);
	}

	reloadAllSessions() {
		return this.context.operations.reloadAllSessions();
	}

	async resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		this.context.operations.resolveExtensionUi(
			sessionId,
			runtimeId,
			uiRequestId,
			response,
		);
	}

	generateCommitMessage(sessionId: string, context: string) {
		return this.context.operations.generateCommitMessage(sessionId, context);
	}

	generateTitle(
		sessionId: string,
		text: string,
		model?: { provider: string; id: string },
	) {
		return this.context.operations.generateTitle(sessionId, text, model);
	}

	getTree(sessionId: string) {
		return this.context.operations.getTree(sessionId);
	}

	branchSession(sessionId: string, entryId: string | null) {
		return this.context.operations.branchSession(sessionId, entryId);
	}

	labelEntry(sessionId: string, entryId: string, label?: string) {
		return this.context.operations.labelEntry(sessionId, entryId, label);
	}

	steer(sessionId: string, text: string, attachments: AgentAttachment[] = []) {
		return this.context.operations.steer(sessionId, text, attachments);
	}

	readAttachment(sessionId: string, attachmentId: string) {
		return this.context.operations.readAttachment(sessionId, attachmentId);
	}

	revealAttachment(sessionId: string, attachmentId: string) {
		return this.context.operations.revealAttachment(sessionId, attachmentId);
	}

	abort(sessionId: string) {
		return this.context.operations.abort(sessionId);
	}

	getCommands(sessionId: string) {
		return this.context.operations.getCommands(sessionId);
	}

	getModelCatalog(sessionId: string) {
		return this.context.operations.getModelCatalog(sessionId);
	}

	selectModel(sessionId: string, provider: string, modelId: string) {
		return this.context.operations.selectModel(sessionId, provider, modelId);
	}

	selectThinkingLevel(sessionId: string, level: string) {
		return this.context.operations.selectThinkingLevel(sessionId, level);
	}

	deleteSession(sessionId: string) {
		return this.context.operations.deleteSession(sessionId);
	}
}
