import type {
	AgentAttachment,
	AgentModelCatalog,
	CompactionPolicy,
	ComposerCommand,
	FileRevertResult,
	GitCommitResult,
	GitStatus,
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
	SessionTree,
	ResourceCatalog,
	InstructionFile,
	InstructionTarget,
	SkillFile,
	StoredProject,
	ProjectConfig,
	ProjectDomains,
	RegistryStatus,
	ToolPolicy,
	WorkspaceDirectoryListing,
	ProviderStatus,
	Extensions,
	ExtensionUiResponse,
	WebExtensionBundles,
	ProjectOpenResult,
	ProjectStatus,
} from '@gizmo/protocol';

export type AgentEventListener = (event: unknown) => void;
export type AgentDisconnectListener = (error: Error) => void;

export interface AttachmentContent {
	name: string;
	mimeType: string;
	data: string;
}

export interface AgentClient {
	listProviders(): Promise<ProviderStatus[]>;
	reimportPiAuth(): Promise<ProviderStatus[]>;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	listSessions(): Promise<SessionCatalog>;
	createSession(options?: SessionOptions): Promise<string>;
	resumeSession(sessionId: string): Promise<SessionSnapshot>;
	renameSession(sessionId: string, title: string): Promise<void>;
	prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments?: AgentAttachment[],
	): Promise<void>;
	listCommands(sessionId: string): Promise<ComposerCommand[]>;
	compact(sessionId: string, compaction: CompactionPolicy): Promise<void>;
	reloadSession(sessionId: string): Promise<void>;
	steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	): Promise<void>;
	abort(sessionId: string): Promise<void>;
	resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	): Promise<void>;
	resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	): Promise<void>;
	deleteSession(sessionId: string): Promise<void>;
	readAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<AttachmentContent>;
	revealAttachment(sessionId: string, attachmentId: string): Promise<void>;
	getSessionTree(sessionId: string): Promise<SessionTree>;
	branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot>;
	labelEntry(
		sessionId: string,
		entryId: string,
		label?: string,
	): Promise<SessionTree>;
	getModelCatalog(sessionId: string): Promise<AgentModelCatalog>;
	selectModel(
		sessionId: string,
		provider: string,
		modelId: string,
	): Promise<AgentModelCatalog>;
	selectThinkingLevel(
		sessionId: string,
		level: string,
	): Promise<AgentModelCatalog>;
	listProjects(): Promise<StoredProject[]>;
	detectProject(projectPath: string): Promise<ProjectDomains>;
	browseProjects(path?: string): Promise<WorkspaceDirectoryListing>;
	searchProjects(
		query: string,
		root?: string,
	): Promise<WorkspaceDirectoryListing>;
	addProject(projectPath: string): Promise<StoredProject>;
	setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig>;
	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig>;
	removeProject(projectPath: string): Promise<void>;
	listResources(workspacePath?: string): Promise<ResourceCatalog>;
	setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	): Promise<ResourceCatalog>;
	setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ResourceCatalog>;
	setGlobalGizmoExtension(
		gizmoExtensionId: string,
		enabled: boolean,
	): Promise<ResourceCatalog>;
	registryStatus(): Promise<RegistryStatus>;
	registryAdd(url: string): Promise<RegistryStatus>;
	registryUpdate(registry: string): Promise<RegistryStatus>;
	registryRemove(registry: string): Promise<RegistryStatus>;
	registryLink(registry: string, id: string): Promise<RegistryStatus>;
	registryUnlink(registry: string, id: string): Promise<RegistryStatus>;
	readSkill(path: string): Promise<SkillFile>;
	writeSkill(path: string, content: string): Promise<SkillFile>;
	readInstructions(
		target: InstructionTarget,
		workspacePath?: string,
	): Promise<InstructionFile>;
	writeInstructions(
		target: InstructionTarget,
		content: string,
		workspacePath?: string,
	): Promise<InstructionFile>;
	setGlobalExtension(
		extensionId: string,
		enabled: boolean,
	): Promise<ResourceCatalog>;
	getToolPolicy(workspacePath?: string): Promise<ToolPolicy>;
	setGlobalToolPolicy(tools: string[]): Promise<ToolPolicy>;
	setProjectToolPolicy(
		workspacePath: string,
		tools: string[] | null,
	): Promise<ToolPolicy>;
	getProjectStatus(projectPath: string): Promise<ProjectStatus>;
	watchProjectStatus(
		sessionId: string,
		projectPath: string,
	): Promise<ProjectStatus>;
	openProject(projectPath: string): Promise<ProjectOpenResult>;
	listProjectExtensions(projectPath: string): Promise<Extensions>;
	/** Standalone web-extension bundles to load at runtime, if the client supports them. */
	listWebExtensionBundles?(): Promise<WebExtensionBundles>;
	invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	): Promise<unknown>;
	revertFile(
		projectPath: string,
		file: string,
		patch: string,
	): Promise<FileRevertResult>;
	generateCommitMessage(
		sessionId: string,
		projectPath: string,
	): Promise<string>;
	/** Optional: transports with a configurable address implement this. */
	setEndpoint?(url: string): void;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
