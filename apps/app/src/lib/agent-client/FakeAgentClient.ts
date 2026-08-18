import {
	agentToolPolicy,
	protocolVersion,
	type AgentAttachment,
	type AgentModelCatalog,
	type AgentSessionSummary,
	type AgentEvent,
	type ConversationMessage,
	type CompactionPolicy,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type UnityConsoleEntry,
	type UnityOpenProjectResult,
	type UnityProject,
	type UnityStatus,
} from '@unity-agent/protocol';
import type {
	AgentClient,
	AgentDisconnectListener,
	AgentEventListener,
} from './AgentClient';

interface FakeSession {
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
type EmittedAgentEvent = WithoutEventEnvelope<AgentEvent>;

export interface FakeAgentClientOptions {
	latencyMs?: number;
	editorOpen?: boolean;
}

export class FakeAgentClient implements AgentClient {
	readonly #latencyMs: number;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #disconnectListeners = new Set<AgentDisconnectListener>();
	readonly #sessions = new Map<string, FakeSession>();
	#connected = false;
	#eventId = 0;
	#id = 0;
	#lastSessionId?: string;
	#editorOpen = true;
	#watchedProject?: { sessionId: string; projectPath: string };
	#consoleTimer?: ReturnType<typeof setInterval>;

	constructor(options: FakeAgentClientOptions = {}) {
		this.#latencyMs = options.latencyMs ?? 90;
		this.#editorOpen = options.editorOpen ?? true;
	}

	async connect(): Promise<void> {
		this.#connected = true;
	}

	async disconnect(): Promise<void> {
		clearInterval(this.#consoleTimer);
		this.#consoleTimer = undefined;
		for (const session of this.#sessions.values())
			session.abortController?.abort();
		this.#connected = false;
		for (const listener of this.#disconnectListeners) {
			listener(new Error('Agent connection closed'));
		}
	}

	/** Simulates the server going away, as opposed to the client leaving. */
	dropConnection(): void {
		this.#connected = false;
		for (const listener of this.#disconnectListeners) {
			listener(new Error('Agent connection closed'));
		}
	}

	async listSessions(): Promise<SessionCatalog> {
		this.#assertConnected();
		return {
			sessions: [...this.#sessions.values()]
				.map(({ summary }) => ({ ...summary }))
				.sort((left, right) => right.lastActiveAt - left.lastActiveAt),
			...(this.#lastSessionId ? { lastSessionId: this.#lastSessionId } : {}),
		};
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		this.#assertConnected();
		const sessionId = `session-${++this.#id}`;
		const now = Date.now();
		this.#sessions.set(sessionId, {
			running: false,
			model: { provider: 'openai-codex', id: 'gpt-5.6-sol' },
			thinkingLevel: 'high',
			summary: {
				id: sessionId,
				title: 'New session',
				projectPath: options.cwd ?? fakeProjects[0]!.path,
				createdAt: now,
				lastActiveAt: now,
				messageCount: 0,
			},
			messages: [],
			labels: new Map(),
		});
		this.#lastSessionId = sessionId;
		this.#emitCreated(this.#getSession(sessionId));
		return sessionId;
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const session = this.#getSession(sessionId);
		this.#lastSessionId = sessionId;
		this.#emitCreated(session);
		return {
			session: { ...session.summary },
			messages: structuredClone(session.messages),
		};
	}

	/** The fake has no branches: one straight line of messages, newest last. */
	async getSessionTree(sessionId: string): Promise<SessionTree> {
		const session = this.#getSession(sessionId);
		return {
			entries: session.messages.map((message, index) => ({
				id: message.id,
				parentId: session.messages[index - 1]?.id ?? null,
				kind: message.role,
				summary: message.content.slice(0, 120),
				detail: message.content,
				...(session.labels.has(message.id)
					? { label: session.labels.get(message.id)! }
					: {}),
				createdAt: message.createdAt,
			})),
			leafId: session.messages.at(-1)?.id ?? null,
		};
	}

	async branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot> {
		const session = this.#getSession(sessionId);
		const index =
			entryId === null
				? -1
				: session.messages.findIndex((message) => message.id === entryId);
		if (entryId !== null && index < 0) {
			throw new Error(`Unknown entry: ${entryId}`);
		}
		session.messages = session.messages.slice(0, index + 1);
		session.summary.messageCount = session.messages.length;
		return {
			session: { ...session.summary },
			messages: structuredClone(session.messages),
		};
	}

	async labelEntry(
		sessionId: string,
		entryId: string,
		label?: string,
	): Promise<SessionTree> {
		const session = this.#getSession(sessionId);
		if (label?.trim()) session.labels.set(entryId, label.trim());
		else session.labels.delete(entryId);
		return this.getSessionTree(sessionId);
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		this.#getSession(sessionId).summary.title = title.trim();
	}

	async prompt(
		sessionId: string,
		text: string,
		_compaction?: CompactionPolicy,
		_attachments?: AgentAttachment[],
	): Promise<void> {
		const session = this.#getSession(sessionId);
		if (session.running) throw new Error('Session is already streaming');

		const abortController = new AbortController();
		session.abortController = abortController;
		session.running = true;

		const userMessageId = `message-${++this.#id}`;
		const userMessage: ConversationMessage = {
			id: userMessageId,
			role: 'user',
			content: text,
			createdAt: Date.now(),
			complete: true,
			tools: [],
		};
		session.messages.push(userMessage);
		session.summary.messageCount++;
		session.summary.lastActiveAt = Date.now();
		if (session.summary.title === 'New session') {
			session.summary.title = sessionTitle(text);
		}
		this.#emit({
			type: 'message.started',
			sessionId,
			messageId: userMessageId,
			role: 'user',
			createdAt: Date.now(),
		});
		this.#emit({
			type: 'message.delta',
			sessionId,
			messageId: userMessageId,
			delta: text,
		});
		this.#emit({
			type: 'message.completed',
			sessionId,
			messageId: userMessageId,
		});
		this.#emit({ type: 'session.state', sessionId, state: 'streaming' });

		const assistantMessageId = `message-${++this.#id}`;
		const assistantMessage: ConversationMessage = {
			id: assistantMessageId,
			role: 'assistant',
			content: '',
			createdAt: Date.now(),
			complete: false,
			tools: [],
		};
		session.messages.push(assistantMessage);
		session.summary.messageCount++;
		this.#emit({
			type: 'message.started',
			sessionId,
			messageId: assistantMessageId,
			role: 'assistant',
			createdAt: Date.now(),
		});

		try {
			for (const delta of [
				'I’ll inspect the connected Editor, ',
				'then check the active project state.',
			]) {
				if (!(await this.#wait(abortController.signal))) return;
				assistantMessage.content += delta;
				this.#emit({
					type: 'message.delta',
					sessionId,
					messageId: assistantMessageId,
					delta,
				});
			}

			const toolCallId = `tool-${++this.#id}`;
			assistantMessage.tools.push({
				id: toolCallId,
				name: 'unity_status',
				status: 'running',
				statusText: 'Starting',
			});
			if (!(await this.#wait(abortController.signal))) return;
			assistantMessage.tools[0]!.statusText = 'Connecting to Unity Editor';
			this.#emit({
				type: 'tool.started',
				sessionId,
				messageId: assistantMessageId,
				toolCallId,
				toolName: 'unity_status',
				input: { projectPath: '/projects/ThirdPersonSandbox' },
			});
			if (!(await this.#wait(abortController.signal))) return;
			Object.assign(assistantMessage.tools[0]!, {
				status: 'complete',
				statusText: 'Completed',
				result: { state: 'connected', instances: [{ port: 6400 }] },
			});
			this.#emit({
				type: 'tool.updated',
				sessionId,
				toolCallId,
				message: 'Connecting to Unity Editor',
			});
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'tool.completed',
				sessionId,
				toolCallId,
				result: {
					state: 'connected',
					ok: true,
					exitCode: 0,
					instances: [
						{
							projectPath: '/projects/ThirdPersonSandbox',
							version: '6000.3.7f1',
							port: 6400,
							pid: 42,
							state: 'ready',
						},
					],
					errors: [],
					warnings: [],
				},
				isError: false,
			});

			const listToolCallId = `tool-${++this.#id}`;
			assistantMessage.tools.push({
				id: listToolCallId,
				name: 'unity_list_commands',
				status: 'running',
				statusText: 'Starting',
			});
			if (!(await this.#wait(abortController.signal))) return;
			Object.assign(assistantMessage.tools[1]!, {
				status: 'complete',
				statusText: 'Completed',
				result: { state: 'available' },
			});
			this.#emit({
				type: 'tool.started',
				sessionId,
				messageId: assistantMessageId,
				toolCallId: listToolCallId,
				toolName: 'unity_list_commands',
				input: { category: 'build', includeHidden: false },
			});
			const editToolCallId = `tool-${++this.#id}`;
			assistantMessage.tools.push({
				id: editToolCallId,
				name: 'edit',
				status: 'running',
				statusText: 'Starting',
			});
			this.#emit({
				type: 'tool.started',
				sessionId,
				messageId: assistantMessageId,
				toolCallId: editToolCallId,
				toolName: 'edit',
				input: {
					file: fakeEditFile,
					oldText: 'private float moveSpeed = 4f;',
					newText: 'private float moveSpeed = 6f;',
				},
			});
			if (!(await this.#wait(abortController.signal))) return;
			Object.assign(assistantMessage.tools[2]!, {
				status: 'complete',
				statusText: 'Completed',
				result: fakeEditResult,
			});
			this.#emit({
				type: 'tool.completed',
				sessionId,
				toolCallId: editToolCallId,
				result: fakeEditResult,
				isError: false,
			});

			if (!(await this.#wait(abortController.signal))) return;
			assistantMessage.content +=
				' The Editor is connected and ready for commands.';
			this.#emit({
				type: 'tool.completed',
				sessionId,
				toolCallId: listToolCallId,
				result: {
					state: 'available',
					ok: true,
					commands: [
						{ name: 'scene.validate' },
						{ name: 'character-controller.describe' },
						{ name: 'assets.find-missing' },
					],
					errors: [],
					warnings: [],
				},
				isError: false,
			});
			if (!(await this.#wait(abortController.signal))) return;
			this.#emit({
				type: 'message.delta',
				sessionId,
				messageId: assistantMessageId,
				delta: ' The Editor is connected and ready for commands.',
			});
		} finally {
			assistantMessage.complete = true;
			session.summary.lastActiveAt = Date.now();
			this.#emit({
				type: 'message.completed',
				sessionId,
				messageId: assistantMessageId,
			});
			this.#emit({ type: 'session.state', sessionId, state: 'idle' });
			session.abortController = undefined;
			session.running = false;
		}
	}

	async compact(
		sessionId: string,
		_compaction: CompactionPolicy,
	): Promise<void> {
		this.#getSession(sessionId);
	}

	async steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	): Promise<void> {
		await this.abort(sessionId);
		await this.prompt(sessionId, text, undefined, attachments);
	}

	async readConsole(
		_projectPath: string,
		tail = 200,
	): Promise<{
		entries: UnityConsoleEntry[];
		cursor?: number;
		dropped: boolean;
	}> {
		return {
			entries: fakeConsoleEntries.slice(-tail),
			cursor: fakeConsoleEntries.length,
			dropped: false,
		};
	}

	async revertFile(
		_projectPath: string,
		file: string,
	): Promise<{ file: string; reverted: boolean }> {
		return { file, reverted: true };
	}

	async abort(sessionId: string): Promise<void> {
		this.#getSession(sessionId).abortController?.abort();
	}

	async deleteSession(sessionId: string): Promise<void> {
		const session = this.#getSession(sessionId);
		session.abortController?.abort();
		this.#sessions.delete(sessionId);
		if (this.#lastSessionId === sessionId) this.#lastSessionId = undefined;
	}

	async readAttachment(): Promise<{
		name: string;
		mimeType: string;
		data: string;
	}> {
		throw new Error('Attachment data is unavailable in the demo client');
	}

	async revealAttachment(): Promise<void> {}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
		return this.#modelCatalog(this.#getSession(sessionId));
	}

	async selectModel(
		sessionId: string,
		provider: string,
		modelId: string,
	): Promise<AgentModelCatalog> {
		const session = this.#getSession(sessionId);
		if (session.running)
			throw new Error('Cannot change models while streaming');
		if (
			!fakeModels.some(
				(model) => model.provider === provider && model.id === modelId,
			)
		) {
			throw new Error(`Unknown model: ${provider}/${modelId}`);
		}
		session.model = { provider, id: modelId };
		return this.#modelCatalog(session);
	}

	async selectThinkingLevel(
		sessionId: string,
		level: string,
	): Promise<AgentModelCatalog> {
		const session = this.#getSession(sessionId);
		if (session.running)
			throw new Error('Cannot change thinking level while streaming');
		if (!fakeThinkingLevels.includes(level)) {
			throw new Error(`Unsupported thinking level: ${level}`);
		}
		session.thinkingLevel = level;
		return this.#modelCatalog(session);
	}

	async listProjects(): Promise<UnityProject[]> {
		this.#assertConnected();
		return fakeProjects;
	}

	async getProjectStatus(projectPath: string): Promise<UnityStatus> {
		this.#assertProject(projectPath);
		return fakeStatus(projectPath, this.#editorOpen);
	}

	async watchProjectStatus(
		sessionId: string,
		projectPath: string,
	): Promise<UnityStatus> {
		this.#getSession(sessionId);
		this.#assertProject(projectPath);
		this.#watchedProject = { sessionId, projectPath };
		this.#streamConsole(sessionId, projectPath);
		return fakeStatus(projectPath, this.#editorOpen);
	}

	/** Trickles console entries out so the live tail has something to show. */
	#streamConsole(sessionId: string, projectPath: string): void {
		clearInterval(this.#consoleTimer);
		let index = 0;
		this.#consoleTimer = setInterval(() => {
			const entry = fakeConsoleEntries[index % fakeConsoleEntries.length];
			index++;
			if (!entry || this.#watchedProject?.sessionId !== sessionId) return;
			this.#emit({
				type: 'project.console.appended',
				sessionId,
				projectPath,
				update: {
					entries: [{ ...entry, seq: index }],
					cursor: index,
					dropped: false,
				},
			});
		}, 2_500);
		this.#consoleTimer.unref?.();
	}

	async openProject(projectPath: string): Promise<UnityOpenProjectResult> {
		this.#assertProject(projectPath);
		const alreadyOpen = this.#editorOpen;
		this.#editorOpen = true;
		if (this.#watchedProject?.projectPath === projectPath) {
			this.#emit({
				type: 'project.status.changed',
				sessionId: this.#watchedProject.sessionId,
				projectPath,
				status: fakeStatus(projectPath, true),
			});
		}
		return {
			state: alreadyOpen ? 'already_open' : 'opened',
			ok: true,
			command: ['unity', 'open', projectPath],
			exitCode: 0,
			durationMs: 1,
			data: null,
			errors: [],
			warnings: [],
			...(alreadyOpen ? { status: fakeStatus(projectPath, true) } : {}),
		};
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener): () => void {
		this.#disconnectListeners.add(listener);
		return () => this.#disconnectListeners.delete(listener);
	}

	#assertConnected(): void {
		if (!this.#connected) throw new Error('Agent client is not connected');
	}

	#getSession(sessionId: string): FakeSession {
		this.#assertConnected();
		const session = this.#sessions.get(sessionId);
		if (!session) throw new Error(`Unknown session: ${sessionId}`);
		return session;
	}

	#assertProject(projectPath: string): void {
		this.#assertConnected();
		if (!fakeProjects.some((project) => project.path === projectPath)) {
			throw new Error('Unknown Unity project');
		}
	}

	#emit(event: EmittedAgentEvent): void {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
		} as AgentEvent;
		for (const listener of this.#listeners) listener(envelope);
	}

	#emitCreated(session: FakeSession): void {
		this.#emit({
			type: 'session.created',
			sessionId: session.summary.id,
			title: session.summary.title,
			model: {
				...session.model,
				thinkingLevel: session.thinkingLevel,
			},
			tools: [...agentToolPolicy.tools],
		});
		this.#emit({
			type: 'session.state',
			sessionId: session.summary.id,
			state: 'idle',
		});
	}

	#modelCatalog(session: FakeSession): AgentModelCatalog {
		return {
			current: {
				...session.model,
				thinkingLevel: session.thinkingLevel,
			},
			models: fakeModels,
			thinkingLevels: fakeThinkingLevels,
		};
	}

	#wait(signal: AbortSignal): Promise<boolean> {
		return new Promise((resolve) => {
			if (signal.aborted) return resolve(false);
			const timeout = window.setTimeout(() => {
				signal.removeEventListener('abort', onAbort);
				resolve(true);
			}, this.#latencyMs);
			const onAbort = () => {
				window.clearTimeout(timeout);
				resolve(false);
			};
			signal.addEventListener('abort', onAbort, { once: true });
		});
	}
}

const fakeModels = [
	{
		provider: 'openai-codex',
		id: 'gpt-5.6-sol',
		name: 'GPT-5.6 Sol',
		reasoning: true,
	},
	{
		provider: 'openai-codex',
		id: 'gpt-5.6-terra',
		name: 'GPT-5.6 Terra',
		reasoning: true,
	},
] satisfies AgentModelCatalog['models'];

const fakeThinkingLevels = ['off', 'low', 'medium', 'high', 'xhigh'];

const fakeProjects: UnityProject[] = [
	{
		title: 'ThirdPersonSandbox',
		path: '/projects/ThirdPersonSandbox',
		version: '6000.3.7f1',
		lastModified: 1,
		isFavorite: true,
		buildTarget: 'StandaloneLinux64',
		renderPipeline: 'Universal',
	},
	{
		title: 'RenderingPlayground',
		path: '/projects/RenderingPlayground',
		version: '6000.3.7f1',
		lastModified: 0,
		isFavorite: false,
	},
];

function fakeStatus(projectPath: string, open: boolean): UnityStatus {
	return {
		state: open ? 'connected' : 'disconnected',
		ok: true,
		command: ['unity', 'status', '--project-path', projectPath],
		exitCode: 0,
		durationMs: 1,
		instances: open
			? [
					{
						projectPath,
						version: '6000.3.7f1',
						port: 6400,
						pid: 42,
						state: 'ready',
					},
				]
			: [],
		errors: [],
		warnings: [],
	};
}

function sessionTitle(prompt: string): string {
	return prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
}

const fakeEditFile = 'Assets/Scripts/PlayerController.cs';

const fakeEditResult = {
	ok: true,
	file: fakeEditFile,
	compilationPending: true,
	compilationPaths: [fakeEditFile],
	patch: [
		`--- a/${fakeEditFile}`,
		`+++ b/${fakeEditFile}`,
		'@@ -12,6 +12,7 @@',
		' public class PlayerController : MonoBehaviour',
		' {',
		'-    [SerializeField] private float moveSpeed = 4f;',
		'+    [SerializeField] private float moveSpeed = 6f;',
		'+    [SerializeField] private float sprintMultiplier = 1.6f;',
		' ',
		'     private CharacterController controller;',
		' }',
	].join('\n'),
	errors: [],
	warnings: [],
};

const fakeConsoleEntries: UnityConsoleEntry[] = [
	{ level: 'log', message: 'Reloading assemblies for play mode' },
	{
		level: 'warn',
		message: 'Shader "Custom/Water" has no fallback for OpenGL ES 2.0',
		file: 'Assets/Shaders/Water.shader',
		line: 42,
	},
	{ level: 'log', message: 'PlayerController awake on ThirdPerson prefab' },
	{
		level: 'error',
		message:
			'NullReferenceException: Object reference not set to an instance of an object',
		file: fakeEditFile,
		line: 58,
		column: 13,
	},
];
