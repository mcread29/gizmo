import {
	parseAgentModelCatalog,
	parseAgentResponse,
	parseFileRevertResult,
	parseGitCommitResult,
	parseGitStatus,
	parseUnityConsoleUpdate,
	parseSessionCatalog,
	parseSessionSnapshot,
	parseSessionTree,
	parseUnityOpenProjectResult,
	parseUnityProjects,
	parseUnityStatus,
	protocolVersion,
	type AgentRequest,
	type AgentAttachment,
	type AgentResponse,
	type AgentModelCatalog,
	type CompactionPolicy,
	type FileRevertResult,
	type GitCommitResult,
	type GitStatus,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type UnityConsoleUpdate,
	type UnityOpenProjectResult,
	type UnityProject,
	type UnityStatus,
} from '@unity-agent/protocol';
import type {
	AgentClient,
	AttachmentContent,
	AgentDisconnectListener,
	AgentEventListener,
} from './AgentClient';

export interface WebSocketAgentClientOptions {
	url?: string;
	createSocket?: (url: string) => WebSocket;
}

interface PendingRequest {
	resolve(response: AgentResponse): void;
	reject(error: Error): void;
}

const socketOpen = 1;
const socketClosed = 3;

type AgentRequestBody = AgentRequest extends infer Request
	? Request extends AgentRequest
		? Omit<Request, 'protocolVersion' | 'requestId'>
		: never
	: never;

export class WebSocketAgentClient implements AgentClient {
	#url: string;
	readonly #createSocket: (url: string) => WebSocket;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #disconnectListeners = new Set<AgentDisconnectListener>();
	readonly #pending = new Map<string, PendingRequest>();
	#socket?: WebSocket;
	#requestId = 0;

	constructor(options: WebSocketAgentClientOptions = {}) {
		this.#url = options.url ?? defaultAgentUrl();
		this.#createSocket = options.createSocket ?? ((url) => new WebSocket(url));
	}

	connect(): Promise<void> {
		if (this.#socket?.readyState === socketOpen) return Promise.resolve();
		if (this.#socket) throw new Error('Agent connection is already opening');

		const socket = this.#createSocket(this.#url);
		this.#socket = socket;
		socket.addEventListener('message', this.#receive);
		socket.addEventListener('close', this.#closed);

		return new Promise((resolve, reject) => {
			const opened = () => {
				cleanup();
				resolve();
			};
			const failed = () => {
				cleanup();
				this.#socket = undefined;
				reject(new Error(`Could not connect to Gizmo at ${this.#url}`));
			};
			const cleanup = () => {
				socket.removeEventListener('open', opened);
				socket.removeEventListener('error', failed);
				socket.removeEventListener('close', failed);
			};
			socket.addEventListener('open', opened);
			socket.addEventListener('error', failed, { once: true });
			socket.addEventListener('close', failed, { once: true });
		});
	}

	/** Takes effect on the next connect; the current socket is left alone. */
	setEndpoint(url: string): void {
		this.#url = url || defaultAgentUrl();
	}

	async disconnect(): Promise<void> {
		const socket = this.#socket;
		if (!socket) return;
		if (socket.readyState === socketClosed) {
			this.#closed();
			return;
		}
		await new Promise<void>((resolve) => {
			socket.addEventListener('close', () => resolve(), { once: true });
			socket.close(1000, 'Client disconnecting');
		});
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		const response = await this.#request({ type: 'session.create', options });
		if (!response.sessionId) {
			throw new Error('Agent server did not return a session ID');
		}
		return response.sessionId;
	}

	async listSessions(): Promise<SessionCatalog> {
		const response = await this.#request({ type: 'session.list' });
		return parseSessionCatalog(response.result);
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const response = await this.#request({ type: 'session.resume', sessionId });
		return parseSessionSnapshot(response.result);
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		await this.#request({ type: 'session.rename', sessionId, title });
	}

	async prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments?: AgentAttachment[],
	): Promise<void> {
		await this.#request({
			type: 'session.prompt',
			sessionId,
			text,
			compaction,
			attachments,
		});
	}

	async compact(
		sessionId: string,
		compaction: CompactionPolicy,
	): Promise<void> {
		await this.#request({ type: 'session.compact', sessionId, compaction });
	}

	async steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	): Promise<void> {
		await this.#request({
			type: 'session.steer',
			sessionId,
			text,
			attachments,
		});
	}

	async abort(sessionId: string): Promise<void> {
		await this.#request({ type: 'session.abort', sessionId });
	}

	async resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	): Promise<void> {
		await this.#request({
			type: 'confirmation.resolve',
			sessionId,
			confirmationId,
			accepted,
		});
	}

	async deleteSession(sessionId: string): Promise<void> {
		await this.#request({ type: 'session.delete', sessionId });
	}

	async readAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<AttachmentContent> {
		const response = await this.#request({
			type: 'attachment.read',
			sessionId,
			attachmentId,
		});
		const result = response.result as Partial<AttachmentContent> | undefined;
		if (
			!result ||
			typeof result.name !== 'string' ||
			typeof result.mimeType !== 'string' ||
			typeof result.data !== 'string'
		) {
			throw new Error('Agent server returned invalid attachment data');
		}
		return result as AttachmentContent;
	}

	async revealAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<void> {
		await this.#request({
			type: 'attachment.reveal',
			sessionId,
			attachmentId,
		});
	}

	async getSessionTree(sessionId: string): Promise<SessionTree> {
		const response = await this.#request({ type: 'session.tree', sessionId });
		return parseSessionTree(response.result);
	}

	async branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot> {
		const response = await this.#request({
			type: 'session.branch',
			sessionId,
			entryId,
		});
		return parseSessionSnapshot(response.result);
	}

	async labelEntry(
		sessionId: string,
		entryId: string,
		label?: string,
	): Promise<SessionTree> {
		const response = await this.#request({
			type: 'session.label',
			sessionId,
			entryId,
			...(label === undefined ? {} : { label }),
		});
		return parseSessionTree(response.result);
	}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
		const response = await this.#request({ type: 'model.catalog', sessionId });
		return parseAgentModelCatalog(response.result);
	}

	async selectModel(
		sessionId: string,
		provider: string,
		modelId: string,
	): Promise<AgentModelCatalog> {
		const response = await this.#request({
			type: 'model.select',
			sessionId,
			provider,
			modelId,
		});
		return parseAgentModelCatalog(response.result);
	}

	async selectThinkingLevel(
		sessionId: string,
		level: string,
	): Promise<AgentModelCatalog> {
		const response = await this.#request({
			type: 'thinking.select',
			sessionId,
			level,
		});
		return parseAgentModelCatalog(response.result);
	}

	async listProjects(): Promise<UnityProject[]> {
		const response = await this.#request({ type: 'project.list' });
		return parseUnityProjects(response.result);
	}

	async getProjectStatus(projectPath: string): Promise<UnityStatus> {
		const response = await this.#request({
			type: 'project.status',
			projectPath,
		});
		return parseUnityStatus(response.result);
	}

	async watchProjectStatus(
		sessionId: string,
		projectPath: string,
	): Promise<UnityStatus> {
		const response = await this.#request({
			type: 'project.watch',
			sessionId,
			projectPath,
		});
		return parseUnityStatus(response.result);
	}

	async openProject(projectPath: string): Promise<UnityOpenProjectResult> {
		const response = await this.#request({
			type: 'project.open',
			projectPath,
		});
		return parseUnityOpenProjectResult(response.result);
	}

	async readConsole(
		projectPath: string,
		tail?: number,
	): Promise<UnityConsoleUpdate> {
		const response = await this.#request({
			type: 'project.console',
			projectPath,
			...(tail === undefined ? {} : { tail }),
		});
		return parseUnityConsoleUpdate(response.result);
	}

	async revertFile(
		projectPath: string,
		file: string,
		patch: string,
	): Promise<FileRevertResult> {
		const response = await this.#request({
			type: 'file.revert',
			projectPath,
			file,
			patch,
		});
		return parseFileRevertResult(response.result);
	}

	async getGitStatus(projectPath: string): Promise<GitStatus> {
		const response = await this.#request({ type: 'git.status', projectPath });
		return parseGitStatus(response.result);
	}

	async generateCommitMessage(
		sessionId: string,
		projectPath: string,
	): Promise<string> {
		const response = await this.#request({
			type: 'git.commit-message',
			sessionId,
			projectPath,
		});
		if (typeof response.result !== 'string' || !response.result.trim()) {
			throw new Error('Agent server returned an invalid commit message');
		}
		return response.result;
	}

	async commitAll(
		projectPath: string,
		message: string,
	): Promise<GitCommitResult> {
		const response = await this.#request({
			type: 'git.commit',
			projectPath,
			message,
		});
		return parseGitCommitResult(response.result);
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	subscribeDisconnect(listener: AgentDisconnectListener): () => void {
		this.#disconnectListeners.add(listener);
		return () => this.#disconnectListeners.delete(listener);
	}

	#request(
		body: AgentRequestBody,
	): Promise<Extract<AgentResponse, { type: 'response.success' }>> {
		const socket = this.#socket;
		if (!socket || socket.readyState !== socketOpen) {
			return Promise.reject(new Error('Agent client is not connected'));
		}
		const requestId = `request-${++this.#requestId}`;
		const request = { ...body, protocolVersion, requestId } as AgentRequest;

		return new Promise((resolve, reject) => {
			this.#pending.set(requestId, {
				resolve: (response) => {
					if (response.type === 'response.error') {
						reject(new Error(response.message));
					} else {
						resolve(response);
					}
				},
				reject,
			});
			socket.send(JSON.stringify(request));
		});
	}

	#receive = (message: MessageEvent) => {
		let input: unknown;
		try {
			input = JSON.parse(String(message.data));
		} catch {
			input = message.data;
		}

		if (
			input &&
			typeof input === 'object' &&
			'type' in input &&
			typeof input.type === 'string' &&
			input.type.startsWith('response.')
		) {
			let response: AgentResponse;
			try {
				response = parseAgentResponse(input);
			} catch (error) {
				this.#rejectAll(
					error instanceof Error ? error : new Error(String(error)),
				);
				return;
			}
			const pending = this.#pending.get(response.requestId);
			if (pending) {
				this.#pending.delete(response.requestId);
				pending.resolve(response);
			}
			return;
		}

		for (const listener of this.#listeners) listener(input);
	};

	#closed = () => {
		if (!this.#socket) return;
		this.#socket = undefined;
		const error = new Error('Agent connection closed');
		this.#rejectAll(error);
		for (const listener of this.#disconnectListeners) listener(error);
	};

	#rejectAll(error: Error): void {
		for (const pending of this.#pending.values()) pending.reject(error);
		this.#pending.clear();
	}
}

function defaultAgentUrl(): string {
	if ('__TAURI_INTERNALS__' in window) {
		return 'ws://127.0.0.1:8787/agent';
	}
	const url = new URL('/agent', window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.href;
}
