import type {
	AgentAttachment,
	AgentModelCatalog,
	CompactionPolicy,
	FileRevertResult,
	GitCommitResult,
	GitStatus,
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
	SessionTree,
	UnityExtensions,
	UnityOpenProjectResult,
	UnityProject,
	UnityStatus,
} from '@unity-agent/protocol';

export type AgentEventListener = (event: unknown) => void;
export type AgentDisconnectListener = (error: Error) => void;

export interface AttachmentContent {
	name: string;
	mimeType: string;
	data: string;
}

export interface AgentClient {
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
	compact(sessionId: string, compaction: CompactionPolicy): Promise<void>;
	steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	): Promise<void>;
	abort(sessionId: string): Promise<void>;
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
	listProjects(): Promise<UnityProject[]>;
	getProjectStatus(projectPath: string): Promise<UnityStatus>;
	watchProjectStatus(
		sessionId: string,
		projectPath: string,
	): Promise<UnityStatus>;
	openProject(projectPath: string): Promise<UnityOpenProjectResult>;
	listProjectExtensions(projectPath: string): Promise<UnityExtensions>;
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
	getGitStatus(projectPath: string): Promise<GitStatus>;
	generateCommitMessage(
		sessionId: string,
		projectPath: string,
	): Promise<string>;
	commitAll(projectPath: string, message: string): Promise<GitCommitResult>;
	/** Optional: transports with a configurable address implement this. */
	setEndpoint?(url: string): void;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
