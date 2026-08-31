import {
	type ComposerCommand,
	type ExtensionUiRequest,
	type WebExtensionBundles,
} from '@gizmo/protocol';
import type { AgentClient } from './AgentClient';
import { FakeExtensionCapability } from './fake-client/extensions';
import { FakeProjectCapability } from './fake-client/projects';
import { FakePromptCapability } from './fake-client/prompt-stream';
import { FakeResourceCapability } from './fake-client/resources';
import { FakeSessionCapability } from './fake-client/sessions';
import {
	FakeClientState,
	type ExtensionUiResolution,
} from './fake-client/state';
import {
	FakeToolPolicyCapability,
	initialToolPolicy,
} from './fake-client/tool-policy';

export interface FakeAgentClientOptions {
	latencyMs?: number;
	editorOpen?: boolean;
	commands?: ComposerCommand[];
	webExtensionBundles?: WebExtensionBundles;
}

/** Stable demo-client entry point; fake behavior lives in capability modules. */
export class FakeAgentClient implements AgentClient {
	readonly #state: FakeClientState;
	readonly #tools: FakeToolPolicyCapability;
	readonly #sessions: FakeSessionCapability;
	readonly #prompts: FakePromptCapability;
	readonly #projects: FakeProjectCapability;
	readonly #resources: FakeResourceCapability;
	readonly #extensions: FakeExtensionCapability;
	readonly extensionUiResponses: ExtensionUiResolution[];
	listWebExtensionBundles?: AgentClient['listWebExtensionBundles'];

	constructor(options: FakeAgentClientOptions = {}) {
		this.#state = new FakeClientState({
			latencyMs: options.latencyMs ?? 90,
			editorOpen: options.editorOpen ?? true,
			commands: options.commands ?? [],
			globalToolPolicy: initialToolPolicy(),
		});
		this.#tools = new FakeToolPolicyCapability(this.#state);
		this.#sessions = new FakeSessionCapability(this.#state, this.#tools);
		this.#prompts = new FakePromptCapability(this.#state, this.#sessions);
		this.#projects = new FakeProjectCapability(this.#state);
		this.#resources = new FakeResourceCapability(this.#state, this.#projects);
		this.#extensions = new FakeExtensionCapability(this.#state);
		this.extensionUiResponses = this.#state.extensionUiResponses;
		if (options.webExtensionBundles) {
			this.listWebExtensionBundles = async () => options.webExtensionBundles!;
		}
	}

	listProviders: AgentClient['listProviders'] = () =>
		this.#sessions.listProviders();
	reimportPiAuth: AgentClient['reimportPiAuth'] = () =>
		this.#sessions.reimportPiAuth();
	connect: AgentClient['connect'] = async () => this.#state.connect();
	disconnect: AgentClient['disconnect'] = async () => this.#state.disconnect();
	listSessions: AgentClient['listSessions'] = () => this.#sessions.list();
	createSession: AgentClient['createSession'] = (options) =>
		this.#sessions.create(options);
	resumeSession: AgentClient['resumeSession'] = (sessionId) =>
		this.#sessions.resume(sessionId);
	renameSession: AgentClient['renameSession'] = (sessionId, title) =>
		this.#sessions.rename(sessionId, title);
	prompt: AgentClient['prompt'] = (sessionId, text, compaction, attachments) =>
		this.#prompts.prompt(sessionId, text, compaction, attachments);
	listCommands: AgentClient['listCommands'] = (sessionId) =>
		this.#sessions.listCommands(sessionId);
	compact: AgentClient['compact'] = (sessionId) =>
		this.#sessions.compact(sessionId);
	reloadSession: AgentClient['reloadSession'] = (sessionId) =>
		this.#sessions.reload(sessionId);
	steer: AgentClient['steer'] = (sessionId, text, attachments) =>
		this.#prompts.steer(sessionId, text, attachments);
	abort: AgentClient['abort'] = (sessionId) => this.#sessions.abort(sessionId);
	deleteSession: AgentClient['deleteSession'] = (sessionId) =>
		this.#sessions.delete(sessionId);
	getSessionTree: AgentClient['getSessionTree'] = (sessionId) =>
		this.#sessions.tree(sessionId);
	branchSession: AgentClient['branchSession'] = (sessionId, entryId) =>
		this.#sessions.branch(sessionId, entryId);
	labelEntry: AgentClient['labelEntry'] = (sessionId, entryId, label) =>
		this.#sessions.label(sessionId, entryId, label);
	getModelCatalog: AgentClient['getModelCatalog'] = (sessionId) =>
		this.#sessions.modelCatalog(sessionId);
	selectModel: AgentClient['selectModel'] = (sessionId, provider, modelId) =>
		this.#sessions.selectModel(sessionId, provider, modelId);
	selectThinkingLevel: AgentClient['selectThinkingLevel'] = (
		sessionId,
		level,
	) => this.#sessions.selectThinkingLevel(sessionId, level);
	listProjects: AgentClient['listProjects'] = () => this.#projects.list();
	detectProject: AgentClient['detectProject'] = (projectPath) =>
		this.#projects.detect(projectPath);
	browseProjects: AgentClient['browseProjects'] = (path) =>
		this.#projects.browse(path);
	searchProjects: AgentClient['searchProjects'] = (query, root) =>
		this.#projects.search(query, root);
	addProject: AgentClient['addProject'] = (projectPath) =>
		this.#projects.add(projectPath);
	setProjectGizmoExtension: AgentClient['setProjectGizmoExtension'] = (
		projectPath,
		extensionId,
		enabled,
	) => this.#projects.setGizmoExtension(projectPath, extensionId, enabled);
	setProjectPiExtension: AgentClient['setProjectPiExtension'] = (
		projectPath,
		extensionId,
		enabled,
	) => this.#projects.setPiExtension(projectPath, extensionId, enabled);
	removeProject: AgentClient['removeProject'] = (projectPath) =>
		this.#projects.remove(projectPath);
	listResources: AgentClient['listResources'] = (workspacePath) =>
		this.#resources.list(workspacePath);
	setGlobalSkill: AgentClient['setGlobalSkill'] = (
		skillId,
		change,
		workspacePath,
	) => this.#resources.setGlobalSkill(skillId, change, workspacePath);
	setProjectSkill: AgentClient['setProjectSkill'] = (
		workspacePath,
		skillId,
		enabled,
	) => this.#resources.setProjectSkill(workspacePath, skillId, enabled);
	setGlobalGizmoExtension: AgentClient['setGlobalGizmoExtension'] = (
		extensionId,
		enabled,
	) => this.#resources.setGlobalGizmoExtension(extensionId, enabled);
	setGlobalExtension: AgentClient['setGlobalExtension'] = () =>
		this.#resources.setGlobalExtension();
	registryStatus: AgentClient['registryStatus'] = () =>
		this.#resources.registryStatus();
	registryAdd: AgentClient['registryAdd'] = (url) =>
		this.#resources.registryAdd(url);
	registryUpdate: AgentClient['registryUpdate'] = () =>
		this.#resources.registryUpdate();
	registryRemove: AgentClient['registryRemove'] = () =>
		this.#resources.registryRemove();
	registryLink: AgentClient['registryLink'] = () =>
		this.#resources.registryLink();
	registryUnlink: AgentClient['registryUnlink'] = () =>
		this.#resources.registryUnlink();
	readSkill: AgentClient['readSkill'] = (path) =>
		this.#resources.readSkill(path);
	writeSkill: AgentClient['writeSkill'] = (path, content) =>
		this.#resources.writeSkill(path, content);
	getToolPolicy: AgentClient['getToolPolicy'] = (workspacePath) =>
		this.#tools.get(workspacePath);
	setGlobalToolPolicy: AgentClient['setGlobalToolPolicy'] = (tools) =>
		this.#tools.setGlobal(tools);
	setProjectToolPolicy: AgentClient['setProjectToolPolicy'] = (
		workspacePath,
		tools,
	) => this.#tools.setProject(workspacePath, tools);
	getProjectStatus: AgentClient['getProjectStatus'] = (projectPath) =>
		this.#projects.status(projectPath);
	watchProjectStatus: AgentClient['watchProjectStatus'] = (
		sessionId,
		projectPath,
	) => this.#projects.watchStatus(sessionId, projectPath);
	openProject: AgentClient['openProject'] = (projectPath) =>
		this.#projects.open(projectPath);
	listProjectExtensions: AgentClient['listProjectExtensions'] = () =>
		this.#extensions.listProjectExtensions();
	invokeProjectExtension: AgentClient['invokeProjectExtension'] = (
		projectPath,
		extensionId,
		operation,
		input,
	) => this.#extensions.invoke(projectPath, extensionId, operation, input);
	revertFile: AgentClient['revertFile'] = (_projectPath, file) =>
		this.#extensions.revertFile(file);
	generateCommitMessage: AgentClient['generateCommitMessage'] = (
		sessionId,
		projectPath,
	) => this.#projects.generateCommitMessage(sessionId, projectPath);
	resolveExtensionUi: AgentClient['resolveExtensionUi'] = (
		sessionId,
		runtimeId,
		uiRequestId,
		response,
	) => this.#extensions.resolveUi(sessionId, runtimeId, uiRequestId, response);
	resolveConfirmation: AgentClient['resolveConfirmation'] = () =>
		this.#extensions.resolveConfirmation();
	readAttachment: AgentClient['readAttachment'] = () =>
		this.#extensions.readAttachment();
	revealAttachment: AgentClient['revealAttachment'] = () =>
		this.#extensions.revealAttachment();
	subscribe: AgentClient['subscribe'] = (listener) =>
		this.#state.subscribe(listener);
	subscribeDisconnect: AgentClient['subscribeDisconnect'] = (listener) =>
		this.#state.subscribeDisconnect(listener);

	/** Simulates the server going away, as opposed to the client leaving. */
	dropConnection() {
		this.#state.dropConnection();
	}

	emitExtensionUi(
		sessionId: string,
		request: ExtensionUiRequest,
		options: { runtimeId?: string; uiRequestId?: string } = {},
	) {
		this.#extensions.emitUi(sessionId, request, options);
	}
}
