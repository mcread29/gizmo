import type {
	AgentAttachment,
	CompactionPolicy,
	ExtensionUiResponse,
	SessionOptions,
} from '@gizmo/protocol';
import { ProjectCatalog } from '../projects/project-catalog';
import { ResourceCatalogService } from '../resources/resource-catalog';
import {
	readManagedSkill,
	setPiExtensionEnabled,
	writeManagedSkill,
} from '../resources/pi-global-resources';
import { AgentEventHub } from './agent-event-hub';
import type {
	AgentEventListener,
	PiAgentServiceOptions,
	PiSessionFactory,
} from './pi-agent-types';
import { listProviders, reimportPiAuth } from './pi-model-runtime';
import { createDefaultPiSession } from './pi-session-factory';
import { SessionCatalogService } from './session-catalog-service';
import { SessionOperations } from './session-operations';
import {
	PiSessionRepository,
	type SessionRepository,
} from './session-repository';
import { SessionRuntimePool } from './session-runtime-pool';
import { ToolPolicyService } from './tool-policy-service';

export class PiAgentService {
	readonly #events: AgentEventHub;
	readonly #pool: SessionRuntimePool;
	readonly #catalog: SessionCatalogService;
	readonly #operations: SessionOperations;
	readonly #projects: ProjectCatalog;
	readonly #resources: ResourceCatalogService;
	readonly #toolPolicy = new ToolPolicyService();

	constructor(
		factory: PiSessionFactory = createDefaultPiSession,
		repository: SessionRepository = new PiSessionRepository(),
		projects: ProjectCatalog = new ProjectCatalog(),
		resources: ResourceCatalogService = new ResourceCatalogService(projects),
		options: PiAgentServiceOptions = {},
	) {
		this.#projects = projects;
		this.#resources = resources;
		this.#events = new AgentEventHub();
		this.#pool = new SessionRuntimePool(this.#events, options);
		this.#catalog = new SessionCatalogService(
			factory,
			repository,
			projects,
			this.#pool,
		);
		this.#operations = new SessionOperations(
			this.#catalog,
			this.#pool,
			repository,
		);
	}

	listProviders() {
		return listProviders();
	}

	reimportPiAuth() {
		return reimportPiAuth();
	}

	createSession(options: SessionOptions = {}) {
		return this.#catalog.createSession(options);
	}

	listSessions() {
		return this.#catalog.listSessions();
	}

	resumeSession(sessionId: string) {
		return this.#catalog.resumeSession(sessionId);
	}

	listProjects() {
		return this.#projects.list();
	}

	detectProject(projectPath: string) {
		return this.#projects.detect(projectPath);
	}

	browseProjects(path?: string) {
		return this.#projects.browse(path);
	}

	searchProjects(query: string, root?: string) {
		return this.#projects.search(query, root);
	}

	addProject(projectPath: string) {
		return this.#projects.add(projectPath);
	}

	setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#projects.setGizmoExtension(projectPath, extensionId, enabled);
	}

	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#projects.setPiExtension(projectPath, extensionId, enabled);
	}

	removeProject(projectPath: string) {
		return this.#projects.remove(projectPath);
	}

	listResources(workspacePath?: string) {
		return this.#resources.list(workspacePath);
	}

	setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		return this.#resources.setGlobalSkill(skillId, change, workspacePath);
	}

	setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		return this.#resources.setProjectSkill(workspacePath, skillId, enabled);
	}

	async readSkill(path: string) {
		const catalog = await this.#resources.list();
		return readManagedSkill(
			path,
			catalog.skills.map((skill) => skill.path),
		);
	}

	async writeSkill(path: string, content: string) {
		const catalog = await this.#resources.list();
		return writeManagedSkill(
			path,
			content,
			catalog.skills
				.filter((skill) => skill.editable)
				.map((skill) => skill.path),
		);
	}

	async setGlobalExtension(extensionId: string, enabled: boolean) {
		await setPiExtensionEnabled(extensionId, enabled);
		return this.#resources.list();
	}

	setGlobalGizmoExtension(extensionId: string, enabled: boolean) {
		return this.#resources.setGlobalGizmoExtension(extensionId, enabled);
	}

	getToolPolicy(workspacePath?: string) {
		return this.#toolPolicy.get(workspacePath);
	}

	setGlobalToolPolicy(tools: string[]) {
		return this.#toolPolicy.setGlobal(tools);
	}

	setProjectToolPolicy(workspacePath: string, tools: string[] | null) {
		return this.#toolPolicy.setProject(workspacePath, tools);
	}

	renameSession(sessionId: string, title: string) {
		return this.#operations.renameSession(sessionId, title);
	}

	prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments: AgentAttachment[] = [],
	) {
		return this.#operations.prompt(sessionId, text, compaction, attachments);
	}

	compact(sessionId: string, policy: CompactionPolicy) {
		return this.#operations.compact(sessionId, policy);
	}

	reloadSession(sessionId: string) {
		return this.#operations.reloadSession(sessionId);
	}

	async resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		this.#operations.resolveExtensionUi(
			sessionId,
			runtimeId,
			uiRequestId,
			response,
		);
	}

	generateCommitMessage(sessionId: string, context: string) {
		return this.#operations.generateCommitMessage(sessionId, context);
	}

	getTree(sessionId: string) {
		return this.#operations.getTree(sessionId);
	}

	branchSession(sessionId: string, entryId: string | null) {
		return this.#operations.branchSession(sessionId, entryId);
	}

	labelEntry(sessionId: string, entryId: string, label?: string) {
		return this.#operations.labelEntry(sessionId, entryId, label);
	}

	steer(sessionId: string, text: string, attachments: AgentAttachment[] = []) {
		return this.#operations.steer(sessionId, text, attachments);
	}

	readAttachment(sessionId: string, attachmentId: string) {
		return this.#operations.readAttachment(sessionId, attachmentId);
	}

	revealAttachment(sessionId: string, attachmentId: string) {
		return this.#operations.revealAttachment(sessionId, attachmentId);
	}

	abort(sessionId: string) {
		return this.#operations.abort(sessionId);
	}

	getCommands(sessionId: string) {
		return this.#operations.getCommands(sessionId);
	}

	getModelCatalog(sessionId: string) {
		return this.#operations.getModelCatalog(sessionId);
	}

	selectModel(sessionId: string, provider: string, modelId: string) {
		return this.#operations.selectModel(sessionId, provider, modelId);
	}

	selectThinkingLevel(sessionId: string, level: string) {
		return this.#operations.selectThinkingLevel(sessionId, level);
	}

	deleteSession(sessionId: string) {
		return this.#operations.deleteSession(sessionId);
	}

	subscribe(listener: AgentEventListener) {
		return this.#events.subscribe(listener);
	}

	resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	) {
		this.#pool.resolveConfirmation(sessionId, confirmationId, accepted);
	}

	abortStreamingSessions() {
		return this.#pool.abortStreamingSessions();
	}

	dispose() {
		this.#pool.dispose();
		this.#events.clear();
	}
}

export type {
	AgentEventListener,
	PiAgentServiceOptions,
	PiSessionCallbacks,
} from './pi-agent-types';
export type { PiSessionFactory, PiSessionLike } from './pi-agent-types';
