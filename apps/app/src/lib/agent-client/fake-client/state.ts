import {
	protocolVersion,
	type AgentEvent,
	type AgentSessionSummary,
	type ComposerCommand,
	type ConversationMessage,
	type ExtensionUiResponse,
	type SkillResource,
	type StoredProject,
} from '@gizmo/protocol';
import type {
	AgentDisconnectListener,
	AgentEventListener,
} from '../AgentClient';
import { createFakeProjects, createFakeSkills } from './fixtures';

export interface FakeSession {
	abortController?: AbortController;
	running: boolean;
	model: { provider: string; id: string };
	thinkingLevel: string;
	summary: AgentSessionSummary;
	messages: ConversationMessage[];
	labels: Map<string, string>;
}

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId'>
	: never;
export type EmittedAgentEvent = WithoutEventEnvelope<AgentEvent>;

export interface ExtensionUiResolution {
	sessionId: string;
	runtimeId: string;
	uiRequestId: string;
	response: ExtensionUiResponse;
}

export class FakeClientState {
	readonly listeners = new Set<AgentEventListener>();
	readonly disconnectListeners = new Set<AgentDisconnectListener>();
	readonly sessions = new Map<string, FakeSession>();
	readonly projects: StoredProject[] = createFakeProjects();
	readonly skills: SkillResource[] = createFakeSkills();
	readonly skillOverrides = new Map<string, Map<string, boolean>>();
	readonly gizmoOverrides = new Map<string, Map<string, boolean>>();
	readonly piOverrides = new Map<string, Map<string, boolean>>();
	readonly disabledGizmoGlobally = new Set<string>();
	readonly projectToolPolicies = new Map<string, string[]>();
	readonly extensionUiResponses: ExtensionUiResolution[] = [];
	readonly latencyMs: number;
	readonly commands: ComposerCommand[];
	connected = false;
	lastSessionId?: string;
	editorOpen: boolean;
	watchedProject?: { sessionId: string; projectPath: string };
	globalToolPolicy: string[];
	#eventId = 0;
	#id = 0;

	constructor(options: {
		latencyMs: number;
		editorOpen: boolean;
		commands: ComposerCommand[];
		globalToolPolicy: string[];
	}) {
		this.latencyMs = options.latencyMs;
		this.editorOpen = options.editorOpen;
		this.commands = options.commands;
		this.globalToolPolicy = options.globalToolPolicy;
	}

	nextId(prefix: string) {
		return `${prefix}-${++this.#id}`;
	}

	connect() {
		this.connected = true;
	}

	disconnect() {
		for (const session of this.sessions.values()) {
			session.abortController?.abort();
		}
		this.dropConnection();
	}

	dropConnection() {
		this.connected = false;
		for (const listener of this.disconnectListeners) {
			listener(new Error('Agent connection closed'));
		}
	}

	assertConnected() {
		if (!this.connected) throw new Error('Agent client is not connected');
	}

	getSession(sessionId: string) {
		this.assertConnected();
		const session = this.sessions.get(sessionId);
		if (!session) throw new Error(`Unknown session: ${sessionId}`);
		return session;
	}

	assertProject(projectPath: string) {
		this.assertConnected();
		if (!this.projects.some((project) => project.path === projectPath)) {
			throw new Error('Unknown Unity project');
		}
	}

	emit(event: EmittedAgentEvent) {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
		} as AgentEvent;
		for (const listener of this.listeners) listener(envelope);
	}

	subscribe(listener: AgentEventListener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener) {
		this.disconnectListeners.add(listener);
		return () => this.disconnectListeners.delete(listener);
	}

	wait(signal: AbortSignal) {
		return new Promise<boolean>((resolve) => {
			if (signal.aborted) return resolve(false);
			const timeout = globalThis.setTimeout(() => {
				signal.removeEventListener('abort', onAbort);
				resolve(true);
			}, this.latencyMs);
			const onAbort = () => {
				globalThis.clearTimeout(timeout);
				resolve(false);
			};
			signal.addEventListener('abort', onAbort, { once: true });
		});
	}
}
