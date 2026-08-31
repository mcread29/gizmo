import type {
	AgentSessionEvent,
	SessionManager,
} from '@earendil-works/pi-coding-agent';
import type {
	AgentEvent,
	AgentModelCatalog,
	CompactionPolicy,
	ComposerCommand,
	SessionOptions,
} from '@gizmo/protocol';
import type { PiImage } from '../attachments/attachment-storage';
import type { PiExtensionUiRuntime } from './pi-extension-ui-runtime';

export interface PiSessionLike {
	readonly sessionId: string;
	readonly domains?: readonly string[];
	readonly sessionName?: string;
	readonly model?: {
		readonly provider: string;
		readonly id: string;
		readonly contextWindow?: number;
	};
	readonly thinkingLevel?: string;
	readonly isStreaming?: boolean;
	getActiveToolNames?(): string[];
	getModelCatalog?(): Promise<AgentModelCatalog>;
	getCommands?(): ComposerCommand[];
	selectModel?(provider: string, modelId: string): Promise<void>;
	selectThinkingLevel?(level: string): void;
	generateCommitMessage?(context: string): Promise<string>;
	configureCompaction?(policy: CompactionPolicy): void;
	compact?(): Promise<unknown>;
	reload?(options?: {
		beforeSessionStart?: () => void | Promise<void>;
	}): Promise<void>;
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	prompt(text: string, options?: { images?: PiImage[] }): Promise<void>;
	steer(text: string, images?: PiImage[]): Promise<void>;
	abort(): Promise<void>;
	/** Live state used to reconstruct the assistant message during streaming. */
	readonly messages?: ReadonlyArray<{
		role: string;
		content?: unknown;
		timestamp?: number;
	}>;
	setSessionName?(name: string): void;
	dispose(): void;
}

export type PiSessionRuntimeOptions = SessionOptions & {
	/** Pi extension ids this workspace disables despite the global state. */
	disabledPiExtensions?: readonly string[];
};

export type PiSessionFactory = (
	options: PiSessionRuntimeOptions,
	sessionManager: SessionManager,
	callbacks: PiSessionCallbacks,
) => Promise<PiSessionLike>;

export interface PiSessionCallbacks {
	confirmStopPlayMode(projectPath: string): Promise<boolean>;
	extensionUi: PiExtensionUiRuntime;
}

export type AgentEventListener = (event: AgentEvent) => void;

export interface PiAgentServiceOptions {
	/** Soft cap; the least-recently-used idle session is evicted first. */
	maxActiveSessions?: number;
	/** How long a non-streaming session may remain resident without use. */
	idleTimeoutMs?: number;
	/** How often the idle sweep runs. */
	sweepIntervalMs?: number;
}
