import {
	agentToolPolicy,
	protocolVersion,
	sessionTitle,
	type AgentAttachment,
	type AgentModelCatalog,
	type AgentSessionSummary,
	type AgentEvent,
	type ConversationMessage,
	type CompactionPolicy,
	type GitCommitResult,
	type GitStatus,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type ExtensionDescriptor,
	type UnityOpenProjectResult,
	type AgentResource,
	type ResourceCatalog,
	type SkillResource,
	type StoredProject,
	type ProjectDomains,
	type WorkspaceIntegration,
	type WorkspaceDirectoryListing,
	type WorkspaceProfiles,
	type UnityStatus,
	type ProviderStatus,
} from '@gizmo/protocol';
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
	async listProviders(): Promise<ProviderStatus[]> {
		this.#assertConnected();
		return fakeProviders;
	}

	async reimportPiAuth(): Promise<ProviderStatus[]> {
		this.#assertConnected();
		return fakeProviders;
	}
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

	constructor(options: FakeAgentClientOptions = {}) {
		this.#latencyMs = options.latencyMs ?? 90;
		this.#editorOpen = options.editorOpen ?? true;
	}

	async connect(): Promise<void> {
		this.#connected = true;
	}

	async disconnect(): Promise<void> {
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
				workspacePath: options.cwd ?? fakeProjects[0]!.path,
				integrations: options.integrations ?? [{ id: 'unity', root: '.' }],
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

	async listProjectExtensions(_projectPath: string): Promise<{
		extensions: ExtensionDescriptor[];
	}> {
		return { extensions: [fakeConsoleExtension] };
	}

	async invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	): Promise<unknown> {
		if (extensionId === 'git' && operation === 'status') {
			this.#assertProject(projectPath);
			return {
				rootPath: projectPath,
				branch: 'main',
				clean: false,
				files: [
					{ path: 'Assets/Scripts/Player.cs', index: ' ', workingTree: 'M' },
				],
			};
		}
		if (extensionId === 'git' && operation === 'commit') {
			this.#assertProject(projectPath);
			const message =
				typeof (input as { message?: unknown } | undefined)?.message ===
				'string'
					? (input as { message: string }).message
					: '';
			return { rootPath: projectPath, commit: '0123456789abcdef', message };
		}
		if (
			extensionId !== fakeConsoleExtension.id ||
			operation !== 'console.snapshot'
		) {
			throw new Error(
				`Unknown extension operation: ${extensionId}/${operation}`,
			);
		}
		return {
			state: 'ready',
			revision: 'fake-console',
			counts: { logs: 2, warnings: 1, errors: 1 },
			entries: fakeConsoleEntries,
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

	async resolveConfirmation(): Promise<void> {}

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

	readonly #skillOverrides = new Map<string, Map<string, boolean>>();

	async listProjects(): Promise<StoredProject[]> {
		this.#assertConnected();
		return fakeProjects;
	}

	async detectProject(_projectPath: string): Promise<ProjectDomains> {
		return {
			domains: [
				{ id: 'unity', name: 'Unity', detected: true, root: '.' },
				{ id: 'svelte', name: 'Svelte', detected: true, root: 'WebFrontend' },
			],
		};
	}

	async browseProjects(path = '/projects'): Promise<WorkspaceDirectoryListing> {
		return {
			path,
			...(path !== '/' ? { parent: '/' } : {}),
			directories:
				path === '/projects'
					? fakeProjects.map((project) => ({
							name: project.title,
							path: project.path,
						}))
					: [],
		};
	}

	async searchProjects(
		query: string,
		root = '/projects',
	): Promise<WorkspaceDirectoryListing> {
		const needle = query.trim().toLowerCase();
		return {
			path: root,
			directories: fakeProjects
				.filter((project) => project.title.toLowerCase().includes(needle))
				.map((project) => ({ name: project.title, path: project.path })),
		};
	}

	async addProject(
		projectPath: string,
		integrations: WorkspaceIntegration[],
	): Promise<StoredProject> {
		const profiles = fakeProfiles(integrations);
		const project = {
			title: projectPath.split('/').at(-1) ?? projectPath,
			path: projectPath,
			integrations,
			activeProfileId: profiles.activeProfileId,
			profiles: profiles.profiles,
			addedAt: Date.now(),
		};
		fakeProjects.splice(
			0,
			fakeProjects.length,
			project,
			...fakeProjects.filter(({ path }) => path !== projectPath),
		);
		return project;
	}

	async saveProjectProfiles(
		projectPath: string,
		profiles: WorkspaceProfiles,
	): Promise<StoredProject> {
		const existing = fakeProjects.find(({ path }) => path === projectPath);
		if (!existing) throw new Error(`Unknown workspace: ${projectPath}`);
		const active = profiles.profiles.find(
			({ id }) => id === profiles.activeProfileId,
		);
		const project = {
			...existing,
			integrations: active?.extensions ?? [],
			activeProfileId: profiles.activeProfileId,
			profiles: profiles.profiles,
		};
		const index = fakeProjects.findIndex(({ path }) => path === projectPath);
		fakeProjects.splice(index, 1, project);
		// The server resolves skill overrides from the active profile, so the
		// catalog has to follow a save the same way.
		this.#skillOverrides.set(
			projectPath,
			new Map((active?.skills ?? []).map(({ id, enabled }) => [id, enabled])),
		);
		return project;
	}

	async removeProject(projectPath: string): Promise<void> {
		const index = fakeProjects.findIndex(({ path }) => path === projectPath);
		if (index >= 0) fakeProjects.splice(index, 1);
	}

	async listResources(workspacePath?: string): Promise<ResourceCatalog> {
		this.#assertConnected();
		return this.#catalog(workspacePath);
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	): Promise<ResourceCatalog> {
		const skill = this.#skill(skillId);
		if (change.installed !== undefined) {
			skill.installed = change.installed;
			if (!change.installed) skill.enabledGlobally = false;
		}
		if (change.enabled !== undefined) {
			skill.enabledGlobally = change.enabled;
			if (change.enabled) skill.installed = true;
		}
		return this.#catalog(workspacePath);
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ResourceCatalog> {
		this.#skill(skillId);
		const overrides = this.#skillOverrides.get(workspacePath) ?? new Map();
		if (enabled === null) overrides.delete(skillId);
		else overrides.set(skillId, enabled);
		this.#skillOverrides.set(workspacePath, overrides);
		return this.#catalog(workspacePath);
	}

	#skill(skillId: string) {
		const skill = fakeSkills.find(({ id }) => id === skillId);
		if (!skill) throw new Error(`Unknown skill: ${skillId}`);
		return skill;
	}

	#catalog(workspacePath?: string): ResourceCatalog {
		const overrides = workspacePath
			? this.#skillOverrides.get(workspacePath)
			: undefined;
		return {
			...(workspacePath ? { workspacePath } : {}),
			skills: fakeSkills.map((skill) => {
				const override = overrides?.get(skill.id);
				return {
					...skill,
					enabled: skill.installed && (override ?? skill.enabledGlobally),
					...(override === undefined ? {} : { override }),
				};
			}),
			agentsFiles: fakeAgentsFiles,
			prompts: fakePrompts,
			diagnostics: [],
		};
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
		return fakeStatus(projectPath, this.#editorOpen);
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

	async generateCommitMessage(
		sessionId: string,
		projectPath: string,
	): Promise<string> {
		this.#getSession(sessionId);
		this.#assertProject(projectPath);
		await this.#wait(new AbortController().signal);
		return 'Update player behavior';
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
			domains: session.summary.integrations?.map(({ id }) => id) ?? [],
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

const fakeProviders: ProviderStatus[] = [
	{
		id: 'openai-codex',
		name: 'OpenAI Codex',
		authenticated: true,
		source: 'OAuth',
		credentialType: 'oauth',
		supportsApiKey: false,
		supportsOAuth: true,
		modelCount: 3,
	},
];

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

function fakeProfiles(integrations: WorkspaceIntegration[]): WorkspaceProfiles {
	const defaultProfile = {
		id: 'default',
		name: 'Default',
		source: 'builtin:default',
		base: null,
		extensions: [],
		tools: { mode: 'default' },
		prompt: { mode: 'pi-default' },
	} satisfies WorkspaceProfiles['profiles'][number];
	const profile =
		integrations.length === 0
			? defaultProfile
			: ({
					id: integrations.map(({ id }) => id).join('-'),
					name: integrations.map(({ id }) => id).join(' + '),
					source: 'workspace:fake',
					base: 'default',
					extensions: integrations,
					tools: { mode: 'default-plus-extension' },
					prompt: { mode: 'default-plus-extension-fragments' },
				} satisfies WorkspaceProfiles['profiles'][number]);
	return {
		version: 1,
		activeProfileId: profile.id,
		profiles:
			profile.id === defaultProfile.id
				? [defaultProfile]
				: [defaultProfile, profile],
	};
}

const fakeProjects: StoredProject[] = [
	{
		title: 'ThirdPersonSandbox',
		path: '/projects/ThirdPersonSandbox',
		integrations: [
			{ id: 'unity', root: '.' },
			{ id: 'svelte', root: 'WebFrontend' },
		],
		activeProfileId: 'unity-svelte',
		profiles: fakeProfiles([
			{ id: 'unity', root: '.' },
			{ id: 'svelte', root: 'WebFrontend' },
		]).profiles,
		addedAt: 1,
	},
	{
		title: 'RenderingPlayground',
		path: '/projects/RenderingPlayground',
		integrations: [{ id: 'unity', root: '.' }],
		activeProfileId: 'unity',
		profiles: fakeProfiles([{ id: 'unity', root: '.' }]).profiles,
		addedAt: 0,
	},
];

const fakeSkills: SkillResource[] = [
	{
		id: 'global/svelte-code-writer',
		name: 'svelte-code-writer',
		description: 'Svelte 5 documentation lookup and component analysis.',
		scope: 'global',
		path: '/home/dev/.gizmo/skills/svelte-code-writer/SKILL.md',
		source: 'user',
		installed: true,
		enabledGlobally: true,
		enabled: true,
	},
	{
		id: 'global/unity-shader-review',
		name: 'unity-shader-review',
		description: 'Review shader graphs and URP materials before a build.',
		scope: 'global',
		path: '/home/dev/.gizmo/skills/unity-shader-review/SKILL.md',
		source: 'user',
		installed: true,
		enabledGlobally: false,
		enabled: false,
	},
	{
		id: 'project/release-checklist',
		name: 'release-checklist',
		description: 'Steps this workspace follows before tagging a release.',
		scope: 'project',
		path: '/projects/ThirdPersonSandbox/.gizmo/skills/release-checklist/SKILL.md',
		source: 'project',
		installed: true,
		enabledGlobally: false,
		enabled: false,
	},
];

const fakeAgentsFiles: AgentResource[] = [
	{
		id: 'agents:/home/dev/.gizmo/AGENTS.md',
		name: 'AGENTS.md',
		description: 'Personal defaults applied to every workspace.',
		scope: 'global',
		path: '/home/dev/.gizmo/AGENTS.md',
	},
	{
		id: 'agents:/projects/ThirdPersonSandbox/AGENTS.md',
		name: 'AGENTS.md',
		description: 'Conventions for this workspace.',
		scope: 'project',
		path: '/projects/ThirdPersonSandbox/AGENTS.md',
	},
];

const fakePrompts: AgentResource[] = [
	{
		id: 'prompt:/home/dev/.gizmo/prompts/review.md',
		name: 'review',
		description: 'Review staged changes.',
		scope: 'global',
		path: '/home/dev/.gizmo/prompts/review.md',
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

const fakeConsoleExtension: ExtensionDescriptor = {
	id: 'unity',
	name: 'Unity',
	version: '0.1.0',
	apiVersion: 1,
	capabilities: ['unity.console'],
	operations: [
		{ id: 'console.snapshot', mutates: false, requiresConfirmation: false },
	],
};

const fakeConsoleEntries = [
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
