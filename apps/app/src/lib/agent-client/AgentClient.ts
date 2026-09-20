import type {
	DigestOverride,
	DigestScope,
	DigestSettings,
	JournalDigest,
	JournalFact,
	MemoryStatus,
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
	ExtensionReloadResult,
} from '@gizmo/protocol';
import type {
	ActionEvent,
	ActionResult,
	ExtensionUi,
	View,
} from '@gizmo/extension-api';

/** Which view of which extension, in which workspace and (maybe) thread. */
export interface ExtensionViewAddress {
	projectPath: string;
	extensionId: string;
	viewId: string;
	sessionId?: string;
}

export type AgentEventListener = (event: unknown) => void;
export type AgentDisconnectListener = (error: Error) => void;

export interface AttachmentContent {
	name: string;
	mimeType: string;
	data: string;
}

export interface AgentClient {
	memoryStatus(projectPath: string): Promise<MemoryStatus>;
	memoryDigests(
		projectPath: string,
		query?: string,
		limit?: number,
	): Promise<JournalDigest[]>;
	/** Only the standing facts; superseded ones never cross the wire. */
	memoryFacts(projectPath: string): Promise<JournalFact[]>;
	/** The default with no project, or that workspace's view of it. */
	memorySettings(projectPath?: string): Promise<DigestScope>;
	setMemoryDefaults(settings: DigestSettings): Promise<DigestSettings>;
	setMemoryOverride(
		projectPath: string,
		override?: DigestOverride,
	): Promise<DigestSettings>;
	startMemoryBackfill(
		projectPath: string,
		regenerate?: boolean,
	): Promise<MemoryStatus>;
	stopMemoryBackfill(projectPath: string): Promise<MemoryStatus>;
	listProviders(): Promise<ProviderStatus[]>;
	reimportPiAuth(): Promise<ProviderStatus[]>;
	setProviderApiKey(
		providerId: string,
		apiKey: string,
	): Promise<ProviderStatus[]>;
	removeProviderApiKey(providerId: string): Promise<ProviderStatus[]>;
	readProviderApiKey(providerId: string): Promise<string>;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	listSessions(): Promise<SessionCatalog>;
	createSession(options?: SessionOptions): Promise<string>;
	resumeSession(sessionId: string): Promise<SessionSnapshot>;
	/** A snapshot for inspection; unlike resume it changes nothing. */
	readSession(sessionId: string): Promise<SessionSnapshot>;
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
	/** Replaces the workspace's explicit Pi extension paths. */
	setProjectExtensionPaths(
		projectPath: string,
		paths: string[],
	): Promise<ProjectConfig>;
	removeProject(projectPath: string): Promise<void>;
	/** Persists the sidebar order; resolves with the catalog in that order. */
	reorderProjects(paths: string[]): Promise<StoredProject[]>;
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
	registryUpdate(): Promise<RegistryStatus>;
	registryLink(id: string): Promise<RegistryStatus>;
	registryUnlink(id: string): Promise<RegistryStatus>;
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
	getProjectStatus(projectPath: string, extensionId: string): Promise<unknown>;
	watchProjectStatus(
		sessionId: string,
		projectPath: string,
		extensionId: string,
	): Promise<unknown>;
	openProject(projectPath: string, extensionId: string): Promise<unknown>;
	listProjectExtensions(projectPath: string): Promise<Extensions>;
	/** What the workspace's enabled extensions contribute to the UI. */
	listExtensionUi(
		projectPath: string,
		sessionId?: string,
	): Promise<ExtensionUi[]>;
	/**
	 * Opens (or joins) a view. The answer is its latest content, if the
	 * extension pushed any; everything after arrives as
	 * `extension.view.updated` events until the view is closed.
	 */
	openExtensionView(
		address: ExtensionViewAddress,
		settings?: Record<string, unknown>,
	): Promise<View | undefined>;
	closeExtensionView(address: ExtensionViewAddress): Promise<void>;
	runExtensionViewAction(
		address: ExtensionViewAddress,
		event: ActionEvent,
	): Promise<ActionResult>;
	runExtensionCommand(
		projectPath: string,
		extensionId: string,
		commandId: string,
		sessionId?: string,
	): Promise<void>;
	/**
	 * Asks the server to reload every linked extension in place: server code
	 * re-evaluates, idle Pi runtimes reload. Optional because the demo client
	 * has nothing to reload.
	 */
	reloadExtensions?(): Promise<ExtensionReloadResult>;
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
	/**
	 * Names a thread from its opening message. Optional: a transport with no
	 * model behind it has nothing to ask.
	 */
	generateSessionTitle?(
		sessionId: string,
		text: string,
		model?: { provider: string; id: string },
	): Promise<string>;
	/** Optional: transports with a configurable address implement this. */
	setEndpoint?(url: string): void;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
