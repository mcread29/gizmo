import { readFile } from 'node:fs/promises';
import type {
	AgentSessionEvent,
	SessionManager,
} from '@earendil-works/pi-coding-agent';
import {
	protocolVersion,
	sessionTitle,
	type AgentAttachment,
	type AgentModelCatalog,
	type CompactionPolicy,
	type ComposerCommand,
	type ExtensionUiResponse,
	type AgentEvent,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type ProviderStatus,
	type ToolPolicy,
} from '@gizmo/protocol';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from './pi-event-translator';
import { inFlightAssistantView } from './session-transcript';
import {
	readToolPolicy,
	writeGlobalToolPolicy,
	writeProjectToolPolicy,
} from '../settings/tool-policy';
import {
	PiSessionRepository,
	defaultDataDir,
	type SessionRepository,
} from './session-repository';
import { sessionTree } from './session-transcript';
import {
	activateExtensions,
	registeredExtensions,
} from '../extensions/registry';
import { extensionResourceRoots } from '../resources/extension-resources';
import { attachmentPrompt } from '../attachments/attachment-message';
import { createRunScriptTool } from '../scripts/run-script-tool';
import { ProjectCatalog } from '../projects/project-catalog';
import { ResourceCatalogService } from '../resources/resource-catalog';
import {
	enabledPiExtensionPaths,
	readManagedSkill,
	setPiExtensionEnabled,
	writeManagedSkill,
} from '../resources/pi-global-resources';
import {
	existingDirectories,
	existingFiles,
	resourceRoots,
} from '../resources/resource-paths';
import {
	prepareAttachments,
	readStoredAttachment,
	revealStoredAttachment,
	type PiImage,
} from '../attachments/attachment-storage';
import { PiExtensionUiRuntime } from './pi-extension-ui-runtime';
import {
	defaultPiRuntimePaths,
	gizmoPiRuntimePaths,
	importPiRuntimeConfig,
	reimportPiAuth,
} from '../config/pi-runtime-config';

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
	/**
	 * Pi's live agent state, including the assistant message currently being
	 * streamed. The session file does not gain a message until it completes,
	 * so mid-stream snapshots need this to render the partial message.
	 */
	readonly messages?: ReadonlyArray<{
		role: string;
		content?: unknown;
		timestamp?: number;
	}>;
	setSessionName?(name: string): void;
	dispose(): void;
}

type PiSessionRuntimeOptions = SessionOptions & {
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

interface ActiveSession {
	session: PiSessionLike;
	/** Held so branching moves the leaf the live session reads from. */
	manager: SessionManager;
	unsubscribe: () => void;
	/** Last time this session was activated or interacted with, for idle eviction. */
	lastActiveAt: number;
	extensionUi: PiExtensionUiRuntime;
	/** Owns the streaming message ids live events reference. */
	translator: PiEventTranslator;
}

export interface PiAgentServiceOptions {
	/** Soft cap on concurrently resident sessions per connection; the least-recently-used idle one is evicted to stay under it. */
	maxActiveSessions?: number;
	/** How long a non-streaming session may sit unused before it's evicted from memory. */
	idleTimeoutMs?: number;
	/** How often the idle sweep runs. */
	sweepIntervalMs?: number;
}

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId' | 'sessionId'>
	: never;
type ServiceEvent = WithoutEventEnvelope<AgentEvent>;

/**
 * Pi applies a workspace's `.pi/settings.json` only when the project is
 * trusted. Resolution matches the session factory's reload-time behavior:
 * no trust-requiring resources means trusted, otherwise a saved decision or
 * the global `defaultProjectTrust` fallback decides.
 */
async function projectSettingsTrusted(
	cwd: string,
	agentDir: string,
): Promise<boolean> {
	const {
		hasTrustRequiringProjectResources,
		ProjectTrustStore,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	if (!hasTrustRequiringProjectResources(cwd)) return true;
	const saved = new ProjectTrustStore(agentDir).get(cwd);
	if (saved !== null) return saved;
	const settingsManager = SettingsManager.create(cwd, agentDir);
	return settingsManager.getDefaultProjectTrust() === 'always';
}

export class PiAgentService {
	readonly #factory: PiSessionFactory;
	readonly #repository: SessionRepository;
	readonly #projects: ProjectCatalog;
	readonly #resources: ResourceCatalogService;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #sessions = new Map<string, ActiveSession>();
	readonly #extensionUiRuntimes = new Map<string, PiExtensionUiRuntime>();
	readonly #confirmations = new Map<
		string,
		{ sessionId: string; resolve: (accepted: boolean) => void }
	>();
	#eventId = 0;
	#confirmationId = 0;
	readonly #maxActiveSessions: number;
	readonly #idleTimeoutMs: number;
	readonly #sweepTimer: NodeJS.Timeout;

	constructor(
		factory: PiSessionFactory = createDefaultPiSession,
		repository: SessionRepository = new PiSessionRepository(),
		projects: ProjectCatalog = new ProjectCatalog(),
		resources: ResourceCatalogService = new ResourceCatalogService(projects),
		options: PiAgentServiceOptions = {},
	) {
		this.#factory = factory;
		this.#repository = repository;
		this.#projects = projects;
		this.#resources = resources;
		this.#maxActiveSessions = options.maxActiveSessions ?? 24;
		this.#idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60_000;
		this.#sweepTimer = setInterval(
			() => this.#evictIdle(),
			options.sweepIntervalMs ?? 5 * 60_000,
		);
		this.#sweepTimer.unref?.();
	}

	async listProviders(): Promise<ProviderStatus[]> {
		const runtime = await gizmoModelRuntime();
		return Promise.all(
			runtime.getProviders().map(async (provider) => {
				const auth = await runtime.checkAuth(provider.id);
				return {
					id: provider.id,
					name: provider.name,
					authenticated: Boolean(auth),
					...(auth?.source ? { source: auth.source } : {}),
					...(auth?.type ? { credentialType: auth.type } : {}),
					supportsApiKey: Boolean(provider.auth.apiKey),
					supportsOAuth: Boolean(provider.auth.oauth),
					modelCount: runtime.getModels(provider.id).length,
				};
			}),
		);
	}

	async reimportPiAuth(): Promise<ProviderStatus[]> {
		if (process.env.GIZMO_PI_WEB !== '1') await reimportPiAuth();
		modelRuntimePromise = undefined;
		return this.listProviders();
	}

	async createSession(options: SessionOptions = {}): Promise<string> {
		const cwd = options.cwd ?? process.cwd();
		const integrations =
			options.integrations ??
			(options.domainId && options.domainId !== 'generic'
				? [{ id: options.domainId, root: '.' }]
				: await this.#projects.integrationsFor(cwd));
		const disabledPiExtensions =
			await this.#projects.disabledPiExtensionsFor(cwd);
		const sessionManager = await this.#repository.create(cwd);
		try {
			const callbacks = this.#callbacks(sessionManager.getSessionId());
			const session = await this.#factory(
				{
					cwd,
					integrations,
					disabledPiExtensions,
				},
				sessionManager,
				callbacks,
			);
			this.#activate(
				session,
				sessionManager,
				'New session',
				callbacks.extensionUi,
			);
			await this.#repository.setLastSession(session.sessionId);
			return session.sessionId;
		} catch (error) {
			this.#extensionUiRuntimes.get(sessionManager.getSessionId())?.clear();
			this.#extensionUiRuntimes.delete(sessionManager.getSessionId());
			await this.#repository.delete(sessionManager.getSessionId());
			throw error;
		}
	}

	async listSessions(): Promise<SessionCatalog> {
		const catalog = await this.#repository.list();
		return {
			...catalog,
			sessions: await Promise.all(
				catalog.sessions.map(async (session) => ({
					...session,
					integrations: await this.#projects.integrationsFor(
						session.workspacePath ?? session.projectPath,
					),
				})),
			),
		};
	}

	async resumeSession(sessionId: string): Promise<SessionSnapshot> {
		const snapshot = await this.#repository.snapshot(sessionId);
		const workspacePath =
			snapshot.session.workspacePath ?? snapshot.session.projectPath;
		const integrations = await this.#projects.integrationsFor(workspacePath);
		const disabledPiExtensions = workspacePath
			? await this.#projects.disabledPiExtensionsFor(workspacePath)
			: [];
		snapshot.session.integrations = integrations;
		if (!this.#sessions.has(sessionId)) {
			const sessionManager = await this.#repository.open(sessionId);
			const callbacks = this.#callbacks(sessionId);
			const session = await this.#factory(
				{
					cwd: workspacePath,
					integrations,
					disabledPiExtensions,
				},
				sessionManager,
				callbacks,
			);
			this.#activate(
				session,
				sessionManager,
				snapshot.session.title,
				callbacks.extensionUi,
			);
		} else {
			this.#touch(sessionId);
			this.#spliceInFlightMessage(sessionId, snapshot);
		}
		await this.#repository.setLastSession(sessionId);
		return snapshot;
	}

	listProjects() {
		return this.#projects.list();
	}

	detectProject(projectPath: string) {
		return this.#projects.detect(projectPath);
	}

	browseProjects(path?: string) {
		return this.#projects.browse(path);
	}

	searchProjects(query: string, root?: string) {
		return this.#projects.search(query, root);
	}

	addProject(projectPath: string) {
		return this.#projects.add(projectPath);
	}

	setProjectGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#projects.setGizmoExtension(projectPath, extensionId, enabled);
	}

	setProjectPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	) {
		return this.#projects.setPiExtension(projectPath, extensionId, enabled);
	}

	removeProject(projectPath: string) {
		return this.#projects.remove(projectPath);
	}

	listResources(workspacePath?: string) {
		return this.#resources.list(workspacePath);
	}

	setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		return this.#resources.setGlobalSkill(skillId, change, workspacePath);
	}

	setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		return this.#resources.setProjectSkill(workspacePath, skillId, enabled);
	}

	async readSkill(path: string) {
		const catalog = await this.#resources.list();
		return readManagedSkill(
			path,
			catalog.skills
				.filter((skill) => skill.editable)
				.map((skill) => skill.path),
		);
	}

	async writeSkill(path: string, content: string) {
		const catalog = await this.#resources.list();
		return writeManagedSkill(
			path,
			content,
			catalog.skills
				.filter((skill) => skill.editable)
				.map((skill) => skill.path),
		);
	}

	async setGlobalExtension(extensionId: string, enabled: boolean) {
		await setPiExtensionEnabled(extensionId, enabled);
		return this.#resources.list();
	}

	async setGlobalGizmoExtension(extensionId: string, enabled: boolean) {
		return this.#resources.setGlobalGizmoExtension(extensionId, enabled);
	}

	/**
	 * Built-in tool availability, stored as Pi's `defaultTools` setting so the
	 * files Gizmo writes are the same ones `pi` itself reads. Resolved for the
	 * workspace the way a session would resolve it: project overrides apply
	 * only when Pi's project-trust rules let them.
	 */
	async getToolPolicy(workspacePath?: string): Promise<ToolPolicy> {
		const agentDir = await this.#toolPolicyAgentDir();
		const cwd = workspacePath ?? process.cwd();
		return readToolPolicy({
			cwd,
			agentDir,
			...(process.env.GIZMO_PI_WEB === '1'
				? { projectTrusted: await projectSettingsTrusted(cwd, agentDir) }
				: {}),
		});
	}

	async setGlobalToolPolicy(tools: string[]): Promise<ToolPolicy> {
		await writeGlobalToolPolicy(await this.#toolPolicyAgentDir(), tools);
		return this.getToolPolicy();
	}

	async setProjectToolPolicy(
		workspacePath: string,
		tools: string[] | null,
	): Promise<ToolPolicy> {
		const agentDir = await this.#toolPolicyAgentDir();
		await writeProjectToolPolicy(workspacePath, tools);
		return readToolPolicy({
			cwd: workspacePath,
			agentDir,
			...(process.env.GIZMO_PI_WEB === '1'
				? {
						projectTrusted: await projectSettingsTrusted(
							workspacePath,
							agentDir,
						),
					}
				: {}),
		});
	}

	async #toolPolicyAgentDir(): Promise<string> {
		if (process.env.GIZMO_PI_WEB === '1') {
			const { getAgentDir } = await import('@earendil-works/pi-coding-agent');
			return getAgentDir();
		}
		return defaultDataDir();
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		const name = title.trim();
		if (!name) throw new Error('Session name cannot be empty');
		const active = this.#sessions.get(sessionId);
		if (active?.session.setSessionName) active.session.setSessionName(name);
		else await this.#repository.rename(sessionId, name);
	}

	async prompt(
		sessionId: string,
		text: string,
		compaction?: CompactionPolicy,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		await this.#ensureActive(sessionId);
		const active = this.#active(sessionId);
		const { session } = active;
		if (compaction) {
			validateCompactionPolicy(compaction);
			session.configureCompaction?.(compaction);
		}
		if (!session.sessionName || session.sessionName === 'New session') {
			await this.renameSession(sessionId, sessionTitle(text));
		}
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await session.prompt(prompt, { images: prepared.images });
		} else await session.prompt(prompt);
	}

	async compact(sessionId: string, policy: CompactionPolicy): Promise<void> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		validateCompactionPolicy(policy);
		if (session.isStreaming)
			throw new Error('Cannot compact while the agent is responding');
		if (!session.compact)
			throw new Error('Compaction is unavailable for this session');
		session.configureCompaction?.(policy);
		await session.compact();
	}

	async reloadSession(sessionId: string): Promise<void> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		if (session.isStreaming)
			throw new Error('Cannot reload while the agent is responding');
		if (!session.reload)
			throw new Error('Runtime reload is unavailable for this session');
		const extensionUi = this.#active(sessionId).extensionUi;
		extensionUi.clear();
		await session.reload({
			beforeSessionStart: () => {
				extensionUi.clear();
				extensionUi.startNewRuntime();
			},
		});
	}

	async resolveExtensionUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	): Promise<void> {
		const extensionUi = this.#extensionUiRuntimes.get(sessionId);
		if (!extensionUi) throw new Error(`Unknown session: ${sessionId}`);
		extensionUi.resolve(runtimeId, uiRequestId, response);
	}

	async generateCommitMessage(
		sessionId: string,
		context: string,
	): Promise<string> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		if (!session.generateCommitMessage) {
			throw new Error(
				'Commit message generation is unavailable for this session',
			);
		}
		return session.generateCommitMessage(context);
	}

	#activate(
		session: PiSessionLike,
		manager: SessionManager,
		title: string,
		extensionUi: PiExtensionUiRuntime,
	): void {
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.#emit(sessionId, this.#withContextWindow(session, event)),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, {
			session,
			manager,
			unsubscribe,
			lastActiveAt: Date.now(),
			extensionUi,
			translator,
		});
		this.#emit(sessionId, {
			type: 'session.created',
			title,
			...(session.domains ? { domains: [...session.domains] } : {}),
			...(session.getActiveToolNames
				? { tools: session.getActiveToolNames() }
				: {}),
			...(session.model
				? {
						model: {
							provider: session.model.provider,
							id: session.model.id,
							thinkingLevel: session.thinkingLevel ?? 'off',
						},
					}
				: {}),
		});
		this.#emit(sessionId, { type: 'session.state', state: 'idle' });
		// Enforce the cap right away, so a burst of activations doesn't wait for
		// the next sweep — the session just activated always sorts last, so it's
		// never the one evicted here.
		this.#evictIdle();
	}

	/**
	 * The session tree, including branches the current transcript does not walk.
	 * Resumes the session first so the tree reflects the live leaf.
	 */
	async getTree(sessionId: string): Promise<SessionTree> {
		await this.resumeSession(sessionId);
		return sessionTree(this.#active(sessionId).manager);
	}

	/**
	 * The transcript file gains an assistant message only when it completes, so
	 * a snapshot taken while a session streams omits the in-flight message.
	 * The client drops live message events for sessions it is not viewing, so
	 * returning to a streaming thread would render nothing for it and every
	 * remaining delta would find no message to attach to. Splice the live
	 * partial message in under the id the translator is still emitting, so the
	 * rebuilt view converges with the ongoing stream instead of losing it.
	 */
	#spliceInFlightMessage(sessionId: string, snapshot: SessionSnapshot): void {
		const active = this.#sessions.get(sessionId);
		if (!active?.session.isStreaming) return;
		const messageId = active.translator.activeAssistantMessageId;
		const last = active.session.messages?.at(-1);
		if (!messageId || !last || last.role !== 'assistant') return;
		snapshot.messages = [
			...snapshot.messages,
			inFlightAssistantView(
				{ role: 'assistant', content: last.content, timestamp: last.timestamp },
				messageId,
			),
		];
	}

	/**
	 * Moves the leaf so the next prompt continues from an earlier entry. A null
	 * entry rewinds past the first message, for re-running the opening prompt.
	 */
	async branchSession(
		sessionId: string,
		entryId: string | null,
	): Promise<SessionSnapshot> {
		await this.resumeSession(sessionId);
		const { session, manager } = this.#active(sessionId);
		if (session.isStreaming) {
			throw new Error('Cannot change branch while the agent is responding');
		}
		if (entryId === null) manager.resetLeaf();
		else if (!manager.getEntry(entryId)) {
			throw new Error(`Unknown entry: ${entryId}`);
		} else manager.branch(entryId);
		return this.#repository.snapshotOf(manager, sessionId);
	}

	async labelEntry(
		sessionId: string,
		entryId: string,
		label?: string,
	): Promise<SessionTree> {
		await this.resumeSession(sessionId);
		const { manager } = this.#active(sessionId);
		if (!manager.getEntry(entryId)) {
			throw new Error(`Unknown entry: ${entryId}`);
		}
		manager.appendLabelChange(entryId, label?.trim() || undefined);
		return sessionTree(manager);
	}

	async steer(
		sessionId: string,
		text: string,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		await this.#ensureActive(sessionId);
		const active = this.#active(sessionId);
		const prepared = await prepareAttachments(active.manager, attachments);
		const prompt = attachmentPrompt(text, prepared.files);
		if (prepared.images.length) {
			await active.session.steer(prompt, prepared.images);
		} else await active.session.steer(prompt);
	}

	async readAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<{ name: string; mimeType: string; data: string }> {
		await this.resumeSession(sessionId);
		return readStoredAttachment(this.#active(sessionId).manager, attachmentId);
	}

	async revealAttachment(
		sessionId: string,
		attachmentId: string,
	): Promise<void> {
		await this.resumeSession(sessionId);
		await revealStoredAttachment(this.#active(sessionId).manager, attachmentId);
	}

	async abort(sessionId: string): Promise<void> {
		this.#cancelConfirmations(sessionId);
		await this.#ensureActive(sessionId);
		this.#active(sessionId).extensionUi.cancelDialogs('abort');
		await this.#session(sessionId).abort();
	}

	async getCommands(sessionId: string): Promise<ComposerCommand[]> {
		await this.#ensureActive(sessionId);
		return this.#session(sessionId).getCommands?.() ?? [];
	}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		if (!session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		return session.getModelCatalog();
	}

	async selectModel(
		sessionId: string,
		provider: string,
		modelId: string,
	): Promise<AgentModelCatalog> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		if (session.isStreaming) {
			throw new Error('Cannot change models while the agent is responding');
		}
		if (!session.selectModel || !session.getModelCatalog) {
			throw new Error('Model selection is unavailable for this session');
		}
		await session.selectModel(provider, modelId);
		return session.getModelCatalog();
	}

	async selectThinkingLevel(
		sessionId: string,
		level: string,
	): Promise<AgentModelCatalog> {
		await this.#ensureActive(sessionId);
		const session = this.#session(sessionId);
		if (session.isStreaming) {
			throw new Error(
				'Cannot change thinking level while the agent is responding',
			);
		}
		if (!session.selectThinkingLevel || !session.getModelCatalog) {
			throw new Error(
				'Thinking-level selection is unavailable for this session',
			);
		}
		session.selectThinkingLevel(level);
		return session.getModelCatalog();
	}

	async deleteSession(sessionId: string): Promise<void> {
		this.#cancelConfirmations(sessionId);
		const active = this.#sessions.get(sessionId);
		if (active) this.#evict(sessionId, active);
		await this.#repository.delete(sessionId);
	}

	subscribe(listener: AgentEventListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	resolveConfirmation(
		sessionId: string,
		confirmationId: string,
		accepted: boolean,
	): void {
		const pending = this.#confirmations.get(confirmationId);
		if (!pending || pending.sessionId !== sessionId) {
			throw new Error(`Unknown confirmation: ${confirmationId}`);
		}
		this.#confirmations.delete(confirmationId);
		pending.resolve(accepted);
	}

	/**
	 * Gives every streaming session a chance to stop cleanly (the same path a
	 * user-initiated abort uses) before the connection tears sessions down —
	 * otherwise `dispose()` cuts generation off mid-write with no chance for
	 * Pi to finalize or persist an interrupted state. Bounded so a hung abort
	 * can't stall shutdown.
	 */
	async abortStreamingSessions(): Promise<void> {
		const timeoutMs = 10_000;
		await Promise.all(
			[...this.#sessions.entries()]
				.filter(([, active]) => active.session.isStreaming)
				.map(async ([sessionId, active]) => {
					try {
						await Promise.race([
							active.session.abort(),
							new Promise((resolve) => setTimeout(resolve, timeoutMs)),
						]);
					} catch (error) {
						console.error(
							`Error aborting session ${sessionId} on disconnect:`,
							error,
						);
					}
				}),
		);
	}

	dispose(): void {
		clearInterval(this.#sweepTimer);
		for (const { resolve } of this.#confirmations.values()) resolve(false);
		this.#confirmations.clear();
		for (const {
			session,
			unsubscribe,
			extensionUi,
		} of this.#sessions.values()) {
			extensionUi.clear();
			unsubscribe();
			session.dispose();
		}
		this.#sessions.clear();
		this.#extensionUiRuntimes.clear();
		this.#listeners.clear();
	}

	#callbacks(sessionId: string): PiSessionCallbacks {
		const extensionUi = new PiExtensionUiRuntime((event) =>
			this.#emit(sessionId, event),
		);
		this.#extensionUiRuntimes.set(sessionId, extensionUi);
		return {
			extensionUi,
			confirmStopPlayMode: (projectPath) =>
				new Promise<boolean>((resolve) => {
					const confirmationId = `confirmation-${++this.#confirmationId}`;
					this.#confirmations.set(confirmationId, { sessionId, resolve });
					this.#emit(sessionId, {
						type: 'confirmation.requested',
						confirmationId,
						kind: 'stop_play_mode_for_compile',
						projectPath,
					});
				}),
		};
	}

	#cancelConfirmations(sessionId: string): void {
		for (const [id, pending] of this.#confirmations) {
			if (pending.sessionId !== sessionId) continue;
			this.#confirmations.delete(id);
			pending.resolve(false);
		}
	}

	#session(sessionId: string): PiSessionLike {
		return this.#active(sessionId).session;
	}

	#active(sessionId: string): ActiveSession {
		const active = this.#sessions.get(sessionId);
		if (!active) throw new Error(`Unknown session: ${sessionId}`);
		return active;
	}

	/**
	 * Cheap when the session is already resident (a Map lookup); only pays for
	 * a full `resumeSession` reconstruction when idle eviction actually dropped
	 * it. Lets the hot-path methods (prompt, steer, abort, ...) stay correct
	 * after an idle eviction without paying resumeSession's snapshot read on
	 * every call.
	 */
	async #ensureActive(sessionId: string): Promise<void> {
		if (this.#sessions.has(sessionId)) {
			this.#touch(sessionId);
			return;
		}
		await this.resumeSession(sessionId);
	}

	#touch(sessionId: string): void {
		const active = this.#sessions.get(sessionId);
		if (active) active.lastActiveAt = Date.now();
	}

	#evict(sessionId: string, active: ActiveSession): void {
		active.extensionUi.clear();
		this.#extensionUiRuntimes.delete(sessionId);
		active.unsubscribe();
		active.session.dispose();
		this.#sessions.delete(sessionId);
	}

	/**
	 * Frees sessions nobody has touched in a while, then — if still over the
	 * cap — frees the least-recently-used ones regardless of idle time. Never
	 * evicts a streaming session: the cap is soft, not a hard limit that could
	 * corrupt an in-flight response.
	 */
	#evictIdle(now = Date.now()): void {
		for (const [id, active] of this.#sessions) {
			if (
				!active.session.isStreaming &&
				now - active.lastActiveAt > this.#idleTimeoutMs
			) {
				this.#evict(id, active);
			}
		}
		if (this.#sessions.size <= this.#maxActiveSessions) return;
		const candidates = [...this.#sessions.entries()]
			.filter(([, active]) => !active.session.isStreaming)
			.sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt);
		for (const [id, active] of candidates) {
			if (this.#sessions.size <= this.#maxActiveSessions) break;
			this.#evict(id, active);
		}
	}

	/** Only the session knows the model, and only the model knows the limit. */
	#withContextWindow(
		session: PiSessionLike,
		event: TranslatedPiEvent,
	): TranslatedPiEvent {
		if (event.type !== 'session.usage' || !session.model?.contextWindow) {
			return event;
		}
		return {
			...event,
			usage: {
				...event.usage,
				contextWindow: session.model.contextWindow,
			},
		};
	}

	#emit(sessionId: string, event: ServiceEvent | TranslatedPiEvent): void {
		const envelope = {
			...event,
			protocolVersion,
			eventId: ++this.#eventId,
			sessionId,
		} as AgentEvent;
		for (const listener of this.#listeners) listener(envelope);
	}
}

const createDefaultPiSession: PiSessionFactory = async (
	options,
	sessionManager,
	callbacks,
) => {
	const {
		createAgentSessionFromServices,
		createAgentSessionServices,
		getAgentDir,
		hasTrustRequiringProjectResources,
		ProjectTrustStore,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	const cwd = options.cwd ?? process.cwd();
	const piWebMode = process.env.GIZMO_PI_WEB === '1';
	const agentDir = piWebMode ? getAgentDir() : defaultDataDir();
	const modelRuntime = piWebMode ? undefined : await gizmoModelRuntime();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	let getSkillCommands: () => ComposerCommand[] = () => [];
	const confirm = (kind: string): Promise<boolean> => {
		if (kind !== 'stop_play_mode_for_compile') {
			throw new Error(`Unsupported confirmation: ${kind}`);
		}
		return callbacks.confirmStopPlayMode(cwd);
	};
	const extensionContext = { workspacePath: cwd, confirm };
	const activeDomains = await activateExtensions(
		extensionContext,
		options.integrations ??
			(options.domainId && options.domainId !== 'generic'
				? [{ id: options.domainId, root: '.' }]
				: []),
	);
	const runScriptTool = createRunScriptTool({ workspacePath: cwd });
	// An enabled Gizmo extension always contributes its tools and guidance.
	const customTools = [...activeDomains.tools, runScriptTool];
	const catalog = new ResourceCatalogService();
	const [
		skillPaths,
		promptPaths,
		agentsFiles,
		fromExtensions,
		piExtensionPaths,
	] = await Promise.all([
		catalog.enabledSkillPaths(cwd),
		existingDirectories(resourceRoots(cwd).prompts),
		readAgentsFiles(cwd),
		extensionResourceRoots(registeredExtensions()),
		enabledPiExtensionPaths(new Set(options.disabledPiExtensions ?? [])),
	]);
	const managedResourceOptions = {
		noExtensions: true,
		additionalExtensionPaths: piExtensionPaths,
		noSkills: true,
		additionalSkillPaths: skillPaths,
		noPromptTemplates: true,
		additionalPromptTemplatePaths: [...promptPaths, ...fromExtensions.prompts],
		noContextFiles: true,
		agentsFilesOverride: () => ({ agentsFiles }),
		...(activeDomains.systemPrompt
			? { systemPromptOverride: () => activeDomains.systemPrompt! }
			: {}),
	};
	const { session } = await (async () => {
		if (piWebMode) {
			// Pi Web is the normal Pi runtime behind Gizmo's existing web shell.
			// Service creation performs discovery before initial model selection so
			// providers registered by Pi extensions participate from the start.
			const services = await createAgentSessionServices({
				cwd,
				agentDir,
				settingsManager,
				resourceLoaderOptions: managedResourceOptions,
				resourceLoaderReloadOptions: {
					resolveProjectTrust: async () => {
						if (!hasTrustRequiringProjectResources(cwd)) return true;
						const saved = new ProjectTrustStore(agentDir).get(cwd);
						if (saved !== null) return saved;
						return settingsManager.getDefaultProjectTrust() === 'always';
					},
				},
			});
			getSkillCommands = () =>
				services.resourceLoader.getSkills().skills.map((skill) => ({
					name: `skill:${skill.name}`,
					description: skill.description,
					source: 'skill',
				}));
			return createAgentSessionFromServices({
				services,
				sessionManager,
				customTools,
			});
		}

		// Normal Gizmo keeps its bounded tool policy while using the same managed
		// global resources. Service creation lets provider extensions register
		// before initial model selection.
		const services = await createAgentSessionServices({
			cwd,
			agentDir,
			settingsManager,
			modelRuntime,
			resourceLoaderOptions: managedResourceOptions,
		});
		getSkillCommands = () =>
			services.resourceLoader.getSkills().skills.map((skill) => ({
				name: `skill:${skill.name}`,
				description: skill.description,
				source: 'skill',
			}));
		// Built-in tool availability follows Pi's `defaultTools` setting, which
		// Gizmo's settings UI writes (see settings/tool-policy.ts). Custom and
		// extension tools are always enabled.
		return createAgentSessionFromServices({
			services,
			customTools,
			sessionManager,
		});
	})();
	await session.bindExtensions({
		// Gizmo supplies a real UI context, so ctx.hasUI is true. Keep the
		// headless mode honest: extensions that special-case Pi's JSONL RPC
		// transport should not mistake the browser bridge for that protocol.
		mode: 'json',
		uiContext: callbacks.extensionUi.context,
		onError: (error) =>
			console.error(
				`Pi extension error (${error.extensionPath}):`,
				error.error,
			),
	});
	return Object.assign(session, {
		domains: activeDomains.extensions.map(({ id }) => id),
		async generateCommitMessage(context: string): Promise<string> {
			if (!session.model) throw new Error('No model is selected');
			const message = await session.modelRuntime.completeSimple(
				session.model,
				{
					systemPrompt:
						'Write a concise Git commit message for the supplied changes. Return only the message: an imperative subject line, optionally followed by a blank line and a short explanatory body. Do not use Markdown fences or quotes.',
					messages: [{ role: 'user', content: context, timestamp: Date.now() }],
				},
				{ maxTokens: 300 },
			);
			if (message.stopReason === 'error') {
				throw new Error(
					message.errorMessage || 'Pi could not generate a commit message',
				);
			}
			const text = message.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('')
				.trim()
				.replace(/^```(?:text)?\s*|\s*```$/g, '')
				.trim();
			if (!text) throw new Error('Pi returned an empty commit message');
			return text;
		},
		configureCompaction(policy: CompactionPolicy): void {
			const contextWindow = session.model?.contextWindow ?? 128_000;
			settingsManager.applyOverrides({
				compaction: {
					enabled: policy.enabled,
					reserveTokens: Math.round(
						contextWindow * (1 - policy.fillPercent / 100),
					),
					keepRecentTokens: Math.round(
						contextWindow * (policy.retainPercent / 100),
					),
					fullTurnBoundaries: true,
				},
			});
		},
		getCommands(): ComposerCommand[] {
			const extensionCommands = session.extensionRunner
				.getRegisteredCommands()
				.map((command) => ({
					name: command.invocationName,
					...(command.description ? { description: command.description } : {}),
					source: 'extension' as const,
				}));
			const prompts = session.promptTemplates.map((prompt) => ({
				name: prompt.name,
				...(prompt.description ? { description: prompt.description } : {}),
				source: 'prompt' as const,
			}));
			return [...extensionCommands, ...prompts, ...getSkillCommands()];
		},
		async getModelCatalog(): Promise<AgentModelCatalog> {
			const models = await session.modelRuntime.getAvailable();
			return {
				...(session.model
					? {
							current: {
								provider: session.model.provider,
								id: session.model.id,
								thinkingLevel: session.thinkingLevel,
							},
						}
					: {}),
				models: models
					.map((model) => ({
						provider: model.provider,
						id: model.id,
						name: model.name,
						reasoning: model.reasoning,
					}))
					.sort((left, right) =>
						`${left.provider}/${left.name}`.localeCompare(
							`${right.provider}/${right.name}`,
						),
					),
				thinkingLevels: session.getAvailableThinkingLevels(),
			};
		},
		async selectModel(provider: string, modelId: string): Promise<void> {
			const model = session.modelRuntime.getModel(provider, modelId);
			if (!model) throw new Error(`Unknown model: ${provider}/${modelId}`);
			await session.setModel(model);
		},
		selectThinkingLevel(level: string): void {
			const available = session.getAvailableThinkingLevels();
			if (!available.includes(level as (typeof available)[number])) {
				throw new Error(`Unsupported thinking level: ${level}`);
			}
			session.setThinkingLevel(
				level as Parameters<typeof session.setThinkingLevel>[0],
			);
		},
	});
};

let modelRuntimePromise:
	Promise<import('@earendil-works/pi-coding-agent').ModelRuntime> | undefined;

function gizmoModelRuntime() {
	if (!modelRuntimePromise) {
		modelRuntimePromise = import('@earendil-works/pi-coding-agent')
			.then(async ({ getAgentDir, ModelRuntime }) => {
				const piWebMode = process.env.GIZMO_PI_WEB === '1';
				const paths = piWebMode
					? defaultPiRuntimePaths(getAgentDir())
					: gizmoPiRuntimePaths();
				if (!piWebMode) await importPiRuntimeConfig(paths.agentDir);
				return ModelRuntime.create({
					authPath: paths.authPath,
					modelsPath: paths.modelsPath,
					modelsStorePath: paths.modelsStorePath,
				});
			})
			.catch((error: unknown) => {
				// Do not cache the rejection: the next caller should retry creation
				// (e.g. after auth was re-imported) rather than fail forever.
				modelRuntimePromise = undefined;
				throw error;
			});
	}
	return modelRuntimePromise;
}

function validateCompactionPolicy(policy: CompactionPolicy): void {
	if (policy.retainPercent >= policy.fillPercent) {
		throw new Error('Retained context must be below the compaction threshold');
	}
}

/** Gizmo's own AGENTS.md files, in the order Pi should apply them. */
async function readAgentsFiles(
	cwd: string,
): Promise<Array<{ path: string; content: string }>> {
	const paths = await existingFiles(resourceRoots(cwd).agentsFiles);
	return Promise.all(
		paths.map(async (path) => ({
			path,
			content: await readFile(path, 'utf8'),
		})),
	);
}
