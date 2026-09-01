import type { AgentAttachment, InstructionTarget } from '@gizmo/protocol';
import type { AgentClient } from './AgentClient';
import { AgentStoreState } from './agent-store/AgentStoreState.svelte';
import { ConnectionCapability } from './agent-store/ConnectionCapability';
import { ExtensionCapability } from './agent-store/ExtensionCapability';
import { GitCapability } from './agent-store/GitCapability';
import { ProjectCapability } from './agent-store/ProjectCapability';
import { RegistryCapability } from './agent-store/RegistryCapability';
import { ResourceCapability } from './agent-store/ResourceCapability';
import { SessionCapability } from './agent-store/SessionCapability';
import { SessionRuntimeCapability } from './agent-store/SessionRuntimeCapability';
import type { PendingConfirmation } from './agent-store/types';

export type {
	AgentError,
	AgentErrorKind,
	AgentModel,
	ConnectionState,
	PendingConfirmation,
} from './agent-store/types';

/** Stable reactive facade coordinating the agent client's capability modules. */
export class AgentStore extends AgentStoreState {
	readonly #connection: ConnectionCapability;
	readonly #extensions: ExtensionCapability;
	readonly #git: GitCapability;
	readonly #projects: ProjectCapability;
	readonly #registry: RegistryCapability;
	readonly #resources: ResourceCapability;
	readonly #sessions: SessionCapability;
	readonly #runtime: SessionRuntimeCapability;

	constructor(
		client: AgentClient,
		options: { allowUnscopedSessions?: boolean } = {},
	) {
		super();
		this.#projects = new ProjectCapability(this, client);
		this.#runtime = new SessionRuntimeCapability(this, client);
		this.#sessions = new SessionCapability(
			this,
			client,
			this.#projects,
			options.allowUnscopedSessions ?? false,
		);
		this.#connection = new ConnectionCapability(this, client, this.#sessions);
		this.#extensions = new ExtensionCapability(this, client);
		this.#git = new GitCapability(this, client);
		this.#registry = new RegistryCapability(this, client);
		this.#resources = new ResourceCapability(this, client);
	}

	refreshProviders() {
		return this.#registry.refreshProviders();
	}
	reimportPiAuth() {
		return this.#registry.reimportPiAuth();
	}
	connect() {
		return this.#connection.connect();
	}
	reconnectTo(url: string) {
		return this.#connection.reconnectTo(url);
	}
	reconnectNow() {
		return this.#connection.reconnectNow();
	}
	disconnect() {
		return this.#connection.disconnect();
	}
	reloadExtensions() {
		return this.#extensions.reloadExtensions();
	}
	refreshProjects() {
		return this.#projects.refreshProjects();
	}
	refreshProjectStatus() {
		return this.#projects.refreshProjectStatus();
	}
	openProjectService(extensionId: string) {
		return this.#projects.openProjectService(extensionId);
	}
	newSession(projectPath?: string) {
		return this.#sessions.newSession(projectPath);
	}
	switchSession(sessionId: string) {
		return this.#sessions.switchSession(sessionId);
	}
	readSession(sessionId: string) {
		return this.#sessions.readSession(sessionId);
	}
	renameSession(sessionId: string, title: string) {
		return this.#sessions.renameSession(sessionId, title);
	}
	deleteSession(sessionId: string) {
		return this.#sessions.deleteSession(sessionId);
	}
	refreshCommands() {
		return this.#runtime.refreshCommands();
	}
	refreshModelCatalog() {
		return this.#runtime.refreshModelCatalog();
	}
	selectModel(provider: string, modelId: string) {
		return this.#runtime.selectModel(provider, modelId);
	}
	selectThinkingLevel(level: string) {
		return this.#runtime.selectThinkingLevel(level);
	}
	prompt(text: string, attachments: AgentAttachment[] = []) {
		return this.#runtime.prompt(text, attachments);
	}
	compact() {
		return this.#runtime.compact();
	}
	reloadRuntime() {
		return this.#runtime.reloadRuntime();
	}
	steer(text: string, attachments: AgentAttachment[] = []) {
		return this.#runtime.steer(text, attachments);
	}
	loadTree() {
		return this.#runtime.loadTree();
	}
	branchTo(entryId: string | null) {
		return this.#runtime.branchTo(entryId);
	}
	labelEntry(entryId: string, label?: string) {
		return this.#runtime.labelEntry(entryId, label);
	}
	abort() {
		return this.#runtime.abort();
	}
	resolveConfirmation(confirmation: PendingConfirmation, accepted: boolean) {
		return this.#runtime.resolveConfirmation(confirmation, accepted);
	}
	isSessionStreaming(sessionId: string | undefined) {
		return this.#runtime.isSessionStreaming(sessionId);
	}
	readAttachment(attachmentId: string) {
		return this.#runtime.readAttachment(attachmentId);
	}
	revealAttachment(attachmentId: string) {
		return this.#runtime.revealAttachment(attachmentId);
	}
	detectProject(projectPath: string) {
		return this.#projects.detectProject(projectPath);
	}
	browseProjects(path?: string) {
		return this.#projects.browseProjects(path);
	}
	searchProjects(query: string, root?: string) {
		return this.#projects.searchProjects(query, root);
	}
	addProject(projectPath: string) {
		return this.#projects.addProject(projectPath);
	}
	reorderProjects(paths: string[]) {
		return this.#projects.reorderProjects(paths);
	}
	removeProject(projectPath: string) {
		return this.#projects.removeProject(projectPath);
	}
	selectWorkspace(projectPath: string) {
		return this.#projects.selectWorkspace(projectPath);
	}
	setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#extensions.setProjectGizmoExtension(
			projectPath,
			extensionId,
			enabled,
		);
	}
	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#extensions.setProjectPiExtension(
			projectPath,
			extensionId,
			enabled,
		);
	}
	loadProjectExtensions() {
		return this.#extensions.loadProjectExtensions();
	}
	invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	) {
		return this.#extensions.invokeProjectExtension(
			projectPath,
			extensionId,
			operation,
			input,
		);
	}
	revertFile(file: string, patch: string) {
		return this.#git.revertFile(file, patch);
	}
	refreshGitStatus() {
		return this.#git.refreshGitStatus();
	}
	generateCommitMessage() {
		return this.#git.generateCommitMessage();
	}
	commitAll(message: string) {
		return this.#git.commitAll(message);
	}
	refreshRegistry() {
		return this.#registry.refreshRegistry();
	}
	registryAdd(url: string) {
		return this.#registry.registryAdd(url);
	}
	registryUpdate(registry: string) {
		return this.#registry.registryUpdate(registry);
	}
	registryRemove(registry: string) {
		return this.#registry.registryRemove(registry);
	}
	registryLink(registry: string, id: string) {
		return this.#registry.registryLink(registry, id);
	}
	registryUnlink(registry: string, id: string) {
		return this.#registry.registryUnlink(registry, id);
	}
	refreshResources(workspacePath?: string) {
		return this.#resources.refreshResources(workspacePath);
	}
	setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		return this.#resources.setGlobalSkill(skillId, change, workspacePath);
	}
	readSkill(path: string) {
		return this.#resources.readSkill(path);
	}
	writeSkill(path: string, content: string) {
		return this.#resources.writeSkill(path, content);
	}
	readInstructions(target: InstructionTarget, workspacePath?: string) {
		return this.#resources.readInstructions(target, workspacePath);
	}
	writeInstructions(
		target: InstructionTarget,
		content: string,
		workspacePath?: string,
	) {
		return this.#resources.writeInstructions(target, content, workspacePath);
	}
	setGlobalExtension(extensionId: string, enabled: boolean) {
		return this.#resources.setGlobalExtension(extensionId, enabled);
	}
	setGlobalGizmoExtension(extensionId: string, enabled: boolean) {
		return this.#resources.setGlobalGizmoExtension(extensionId, enabled);
	}
	setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		return this.#resources.setProjectSkill(workspacePath, skillId, enabled);
	}
	refreshToolPolicy(workspacePath?: string) {
		return this.#resources.refreshToolPolicy(workspacePath);
	}
	setGlobalToolPolicy(tools: string[]) {
		return this.#resources.setGlobalToolPolicy(tools);
	}
	setProjectToolPolicy(workspacePath: string, tools: string[] | null) {
		return this.#resources.setProjectToolPolicy(workspacePath, tools);
	}
}
