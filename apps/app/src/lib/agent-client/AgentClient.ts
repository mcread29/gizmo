import type {
	AgentModelCatalog,
	FileRevertResult,
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
	UnityConsoleUpdate,
	UnityOpenProjectResult,
	UnityProject,
	UnityStatus,
} from '@unity-agent/protocol';

export type AgentEventListener = (event: unknown) => void;
export type AgentDisconnectListener = (error: Error) => void;

export interface AgentClient {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	listSessions(): Promise<SessionCatalog>;
	createSession(options?: SessionOptions): Promise<string>;
	resumeSession(sessionId: string): Promise<SessionSnapshot>;
	renameSession(sessionId: string, title: string): Promise<void>;
	prompt(sessionId: string, text: string): Promise<void>;
	steer(sessionId: string, text: string): Promise<void>;
	abort(sessionId: string): Promise<void>;
	deleteSession(sessionId: string): Promise<void>;
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
	readConsole(projectPath: string, tail?: number): Promise<UnityConsoleUpdate>;
	revertFile(
		projectPath: string,
		file: string,
		patch: string,
	): Promise<FileRevertResult>;
	/** Optional: transports with a configurable address implement this. */
	setEndpoint?(url: string): void;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
