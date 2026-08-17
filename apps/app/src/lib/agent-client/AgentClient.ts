import type {
	SessionCatalog,
	SessionOptions,
	SessionSnapshot,
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
	listProjects(): Promise<UnityProject[]>;
	getProjectStatus(projectPath: string): Promise<UnityStatus>;
	openProject(projectPath: string): Promise<UnityOpenProjectResult>;
	subscribe(listener: AgentEventListener): () => void;
	subscribeDisconnect(listener: AgentDisconnectListener): () => void;
}
