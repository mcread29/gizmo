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
	type AgentEvent,
	type SessionCatalog,
	type SessionOptions,
	type SessionSnapshot,
	type SessionTree,
	type ProviderStatus,
} from '@unity-agent/protocol';
import {
	PiEventTranslator,
	type TranslatedPiEvent,
} from './pi-event-translator';
import {
	PiSessionRepository,
	defaultDataDir,
	type SessionRepository,
} from './session-repository';
import { sessionTree } from './session-transcript';
import { activateDomains } from '../domains/registry';
import { attachmentPrompt } from '../attachments/attachment-message';
import { GitService } from '../git/git-service';
import { ProjectCatalog } from '../projects/project-catalog';
import { ResourceCatalogService } from '../resources/resource-catalog';
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
import {
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
	selectModel?(provider: string, modelId: string): Promise<void>;
	selectThinkingLevel?(level: string): void;
	generateCommitMessage?(context: string): Promise<string>;
	configureCompaction?(policy: CompactionPolicy): void;
	compact?(): Promise<unknown>;
	subscribe(listener: (event: AgentSessionEvent) => void): () => void;
	prompt(text: string, options?: { images?: PiImage[] }): Promise<void>;
	steer(text: string, images?: PiImage[]): Promise<void>;
	abort(): Promise<void>;
	setSessionName?(name: string): void;
	dispose(): void;
}

export type PiSessionFactory = (
	options: SessionOptions,
	sessionManager: SessionManager,
	callbacks: PiSessionCallbacks,
) => Promise<PiSessionLike>;

export interface PiSessionCallbacks {
	confirmStopPlayMode(projectPath: string): Promise<boolean>;
}
export type AgentEventListener = (event: AgentEvent) => void;

interface ActiveSession {
	session: PiSessionLike;
	/** Held so branching moves the leaf the live session reads from. */
	manager: SessionManager;
	unsubscribe: () => void;
}

type WithoutEventEnvelope<T> = T extends AgentEvent
	? Omit<T, 'protocolVersion' | 'eventId' | 'sessionId'>
	: never;
type ServiceEvent = WithoutEventEnvelope<AgentEvent>;

export class PiAgentService {
	readonly #factory: PiSessionFactory;
	readonly #repository: SessionRepository;
	readonly #projects: ProjectCatalog;
	readonly #resources: ResourceCatalogService;
	readonly #listeners = new Set<AgentEventListener>();
	readonly #sessions = new Map<string, ActiveSession>();
	readonly #confirmations = new Map<
		string,
		{ sessionId: string; resolve: (accepted: boolean) => void }
	>();
	#eventId = 0;
	#confirmationId = 0;

	constructor(
		factory: PiSessionFactory = createDefaultPiSession,
		repository: SessionRepository = new PiSessionRepository(),
		projects: ProjectCatalog = new ProjectCatalog(),
		resources: ResourceCatalogService = new ResourceCatalogService(projects),
	) {
		this.#factory = factory;
		this.#repository = repository;
		this.#projects = projects;
		this.#resources = resources;
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
		await reimportPiAuth();
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
		const sessionManager = await this.#repository.create(cwd);
		try {
			const session = await this.#factory(
				{ cwd, integrations },
				sessionManager,
				this.#callbacks(sessionManager.getSessionId()),
			);
			this.#activate(session, sessionManager, 'New session');
			await this.#repository.setLastSession(session.sessionId);
			return session.sessionId;
		} catch (error) {
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
		snapshot.session.integrations = integrations;
		if (!this.#sessions.has(sessionId)) {
			const sessionManager = await this.#repository.open(sessionId);
			const session = await this.#factory(
				{ cwd: workspacePath, integrations },
				sessionManager,
				this.#callbacks(sessionId),
			);
			this.#activate(session, sessionManager, snapshot.session.title);
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

	addProject(
		projectPath: string,
		integrations: NonNullable<SessionOptions['integrations']>,
	) {
		return this.#projects.add(projectPath, integrations);
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
		const session = this.#session(sessionId);
		validateCompactionPolicy(policy);
		if (session.isStreaming)
			throw new Error('Cannot compact while the agent is responding');
		if (!session.compact)
			throw new Error('Compaction is unavailable for this session');
		session.configureCompaction?.(policy);
		await session.compact();
	}

	async generateCommitMessage(
		sessionId: string,
		context: string,
	): Promise<string> {
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
	): void {
		const sessionId = session.sessionId;
		const translator = new PiEventTranslator((event) =>
			this.#emit(sessionId, this.#withContextWindow(session, event)),
		);
		const unsubscribe = session.subscribe((event) => translator.receive(event));
		this.#sessions.set(sessionId, { session, manager, unsubscribe });
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

	abort(sessionId: string): Promise<void> {
		this.#cancelConfirmations(sessionId);
		return this.#session(sessionId).abort();
	}

	async getModelCatalog(sessionId: string): Promise<AgentModelCatalog> {
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
		if (active) {
			active.unsubscribe();
			active.session.dispose();
			this.#sessions.delete(sessionId);
		}
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

	dispose(): void {
		for (const { resolve } of this.#confirmations.values()) resolve(false);
		this.#confirmations.clear();
		for (const { session, unsubscribe } of this.#sessions.values()) {
			unsubscribe();
			session.dispose();
		}
		this.#sessions.clear();
		this.#listeners.clear();
	}

	#callbacks(sessionId: string): PiSessionCallbacks {
		return {
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
	const { createAgentSession, DefaultResourceLoader, SettingsManager } =
		await import('@earendil-works/pi-coding-agent');
	const cwd = options.cwd ?? process.cwd();
	const agentDir = defaultDataDir();
	const modelRuntime = await gizmoModelRuntime();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	const activeDomains = await activateDomains(
		{
			workspacePath: cwd,
			confirm: (kind) => {
				if (kind !== 'stop_play_mode_for_compile') {
					throw new Error(`Unsupported confirmation: ${kind}`);
				}
				return callbacks.confirmStopPlayMode(cwd);
			},
		},
		options.integrations ??
			(options.domainId && options.domainId !== 'generic'
				? [{ id: options.domainId, root: '.' }]
				: []),
	);
	// Every resource is supplied explicitly from Gizmo-owned folders: Pi's own
	// discovery locations contribute nothing, so what the model sees is exactly
	// what Gizmo's settings say it should.
	const catalog = new ResourceCatalogService();
	const [skillPaths, promptPaths, agentsFiles] = await Promise.all([
		catalog.enabledSkillPaths(cwd),
		existingDirectories(resourceRoots(cwd).prompts),
		readAgentsFiles(cwd),
	]);
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noContextFiles: true,
		additionalSkillPaths: skillPaths,
		additionalPromptTemplatePaths: promptPaths,
		agentsFilesOverride: () => ({ agentsFiles }),
		...(activeDomains.systemPrompt
			? { systemPromptOverride: () => activeDomains.systemPrompt! }
			: {}),
	});
	await resourceLoader.reload();
	const git = new GitService();
	const { session } = await createAgentSession({
		cwd,
		agentDir,
		customTools: [...activeDomains.tools, git.createStatusTool(cwd)],
		tools: [
			'read',
			'edit',
			'write',
			'git_status',
			...activeDomains.tools.map(({ name }) => name),
		],
		resourceLoader,
		modelRuntime,
		sessionManager,
		settingsManager,
	});
	return Object.assign(session, {
		domains: activeDomains.domains.map(({ id }) => id),
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
		modelRuntimePromise = import('@earendil-works/pi-coding-agent').then(
			async ({ ModelRuntime }) => {
				const paths = gizmoPiRuntimePaths();
				await importPiRuntimeConfig(paths.agentDir);
				return ModelRuntime.create({
					authPath: paths.authPath,
					modelsPath: paths.modelsPath,
					modelsStorePath: paths.modelsStorePath,
				});
			},
		);
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
