import {
	parseAgentEvent,
	sessionTitle,
	type AgentAttachment,
	type AgentModelCatalog,
	type AgentModelOption,
	type AgentEvent,
	type AgentSessionSummary,
	type ConversationMessage,
	type CompactionPolicy,
	type GitCommitResult,
	type GitStatus,
	type SessionSnapshot,
	type SessionState,
	type SessionTree,
	type SessionUsage,
	type ExtensionDescriptor,
	type ResourceCatalog,
	type StoredProject,
	type ProjectDomains,
	type WorkspaceIntegration,
	type WorkspaceDirectoryListing,
	type WorkspaceProfiles,
	type UnityStatus,
	type ProviderStatus,
} from '@gizmo/protocol';
import type { AgentClient } from './AgentClient';
import { applyAgentEvent } from './agent-event-reducer';
import { extension } from '../extensions/registry';

export interface AgentModel {
	provider: string;
	id: string;
	thinkingLevel: string;
}

export type AgentErrorKind =
	'connection' | 'prompt' | 'session' | 'project' | 'agent';

export interface AgentError {
	kind: AgentErrorKind;
	message: string;
}

export type PendingConfirmation = Extract<
	AgentEvent,
	{ type: 'confirmation.requested' }
>;

export type ConnectionState =
	'disconnected' | 'connecting' | 'reconnecting' | 'connected';

interface SessionSelection {
	sessionId?: string;
	sessionState: SessionState;
	messages: ConversationMessage[];
	messagesLoading: boolean;
	model?: AgentModel;
	availableModels: AgentModelOption[];
	thinkingLevels: string[];
	activeDomains: string[];
	selectedProjectPath?: string;
	projectStatus?: UnityStatus;
	usage?: SessionUsage;
}

/** Backoff between automatic reconnects; the last entry repeats forever. */
const reconnectDelays = [500, 1_000, 2_000, 5_000, 10_000, 15_000];

export class AgentStore {
	compactionPolicy: CompactionPolicy = {
		enabled: true,
		fillPercent: 25,
		retainPercent: 10,
	};
	compacting = $state(false);
	connection = $state<ConnectionState>('disconnected');
	reconnectAttempt = $state(0);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	sessionStates = $state<Record<string, SessionState>>({});
	model = $state<AgentModel>();
	availableModels = $state<AgentModelOption[]>([]);
	thinkingLevels = $state<string[]>([]);
	modelLoading = $state(false);
	activeTools = $state<string[]>([]);
	activeDomains = $state<string[]>([]);
	messages = $state<ConversationMessage[]>([]);
	messagesLoading = $state(false);
	/** Most recently submitted text, recalled into an empty composer with Up. */
	lastPrompt = $state<string>();
	sessions = $state<AgentSessionSummary[]>([]);
	projects = $state<StoredProject[]>([]);
	selectedProjectPath = $state<string>();
	projectStatus = $state<UnityStatus>();
	projectsLoading = $state(false);
	projectOpening = $state(false);
	projectError = $state<string>();
	error = $state<AgentError>();
	projectExtensions = $state<ExtensionDescriptor[]>([]);
	extensionsLoading = $state(false);
	usage = $state<SessionUsage>();
	pendingConfirmations = $state<PendingConfirmation[]>([]);
	gitStatus = $state<GitStatus>();
	gitLoading = $state(false);
	/** True from the moment a workspace is selected until its status lands. */
	statusLoading = $state(false);
	gitCommitting = $state(false);
	resources = $state<ResourceCatalog>();
	resourcesLoading = $state(false);
	resourceError = $state<string>();
	providers = $state.raw<ProviderStatus[]>([]);
	providersLoading = $state(false);
	providerError = $state<string>();

	readonly #client: AgentClient;
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;
	#statusRequest?: { projectPath: string; promise: Promise<void> };
	#reconnectTimer?: ReturnType<typeof setTimeout>;
	#autoReconnect = true;

	constructor(client: AgentClient) {
		this.#client = client;
	}

	async refreshProviders(): Promise<void> {
		if (this.connection !== 'connected') return;
		this.providersLoading = true;
		this.providerError = undefined;
		try {
			this.providers = await this.#client.listProviders();
		} catch (error) {
			this.providerError = errorMessage(error);
		} finally {
			this.providersLoading = false;
		}
	}

	async reimportPiAuth(): Promise<boolean> {
		if (this.connection !== 'connected') return false;
		this.providersLoading = true;
		this.providerError = undefined;
		try {
			this.providers = await this.#client.reimportPiAuth();
			return true;
		} catch (error) {
			this.providerError = errorMessage(error);
			return false;
		} finally {
			this.providersLoading = false;
		}
	}

	async connect(): Promise<void> {
		if (this.connection === 'connecting' || this.connection === 'connected') {
			return;
		}
		this.#autoReconnect = true;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.connection = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
		this.error = undefined;
		this.#unsubscribe = this.#client.subscribe((input) => this.#receive(input));
		this.#unsubscribeDisconnect = this.#client.subscribeDisconnect((error) => {
			if (this.connection !== 'connected') return;
			this.connection = 'disconnected';
			this.error = { kind: 'connection', message: error.message };
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		});
		// Remembered so a reconnect lands the user back where they were rather
		// than on whichever thread the server happens to consider most recent.
		const resumeId = this.sessionId;
		try {
			await this.#client.connect();
			this.connection = 'connected';
			this.reconnectAttempt = 0;
			this.sessionId = undefined;
			this.messages = [];
			await this.refreshProjects();
			const catalog = await this.#client.listSessions();
			this.sessions = catalog.sessions;
			this.sessionStates = Object.fromEntries(
				this.sessions.map((session) => [session.id, 'idle' as const]),
			);
			const session =
				this.sessions.find(({ id }) => id === resumeId) ??
				this.sessions.find(({ id }) => id === catalog.lastSessionId) ??
				this.sessions[0];
			// Projects load first, so an opening thread always has a workspace.
			if (session) await this.switchSession(session.id);
			else await this.newSession();
		} catch (error) {
			this.#fail('connection', error);
			this.sessionId = resumeId;
			this.connection = 'disconnected';
			this.#cleanupSubscriptions();
			this.#scheduleReconnect();
		}
	}

	/** Points the client at a different agent server and reconnects. */
	async reconnectTo(url: string): Promise<void> {
		if (!this.#client.setEndpoint) return;
		await this.disconnect();
		this.#client.setEndpoint(url);
		await this.reconnectNow();
	}

	/** Abandons the backoff and reconnects immediately. */
	async reconnectNow(): Promise<void> {
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.reconnectAttempt = 0;
		if (this.connection === 'disconnected') await this.connect();
	}

	#scheduleReconnect(): void {
		if (!this.#autoReconnect || this.#reconnectTimer !== undefined) return;
		const delay =
			reconnectDelays[
				Math.min(this.reconnectAttempt, reconnectDelays.length - 1)
			]!;
		this.reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined;
			void this.connect();
		}, delay);
	}

	async refreshProjects(): Promise<void> {
		if (this.connection !== 'connected') return;
		this.projectsLoading = true;
		this.projectError = undefined;
		try {
			this.projects = await this.#client.listProjects();
			if (
				!this.selectedProjectPath ||
				!this.projects.some(
					(project) => project.path === this.selectedProjectPath,
				)
			) {
				this.selectedProjectPath = this.projects[0]?.path;
			}
			await this.refreshProjectStatus();
		} catch (error) {
			this.projectError = errorMessage(error);
		} finally {
			this.projectsLoading = false;
		}
	}

	refreshProjectStatus(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) {
			return Promise.resolve();
		}
		const projectPath = this.selectedProjectPath;
		if (this.#statusRequest?.projectPath === projectPath) {
			return this.#statusRequest.promise;
		}
		const promise = this.#loadProjectStatus().finally(() => {
			if (this.#statusRequest?.projectPath === projectPath) {
				this.#statusRequest = undefined;
			}
		});
		this.#statusRequest = { projectPath, promise };
		return promise;
	}

	async #loadProjectStatus(): Promise<void> {
		const projectPath = this.selectedProjectPath;
		if (!projectPath) return;
		try {
			const status = await this.#client.getProjectStatus(projectPath);
			if (this.selectedProjectPath === projectPath) {
				this.projectStatus = status;
				this.projectError = undefined;
			}
		} catch (error) {
			if (this.selectedProjectPath === projectPath) {
				this.projectError = errorMessage(error);
			}
		} finally {
			if (this.selectedProjectPath === projectPath) this.statusLoading = false;
		}
	}

	async openSelectedProject(): Promise<void> {
		if (!this.selectedProjectPath || this.projectOpening) return;
		this.projectOpening = true;
		this.projectError = undefined;
		try {
			const result = await this.#client.openProject(this.selectedProjectPath);
			if (!result.ok || result.state === 'error') {
				throw new Error(
					result.errors[0]?.message ??
						result.stderr ??
						'Unity Editor could not be opened.',
				);
			}
			await Promise.all([
				this.refreshProjectStatus(),
				this.loadProjectExtensions(),
			]);
		} catch (error) {
			this.projectError = errorMessage(error);
		} finally {
			this.projectOpening = false;
		}
	}

	async newSession(
		projectPath?: string,
		integrations?: WorkspaceIntegration[],
	): Promise<void> {
		if (this.connection !== 'connected') return;
		const workspacePath = projectPath ?? this.selectedProjectPath;
		// Threads do not exist outside a workspace; without one there is nothing
		// to create the thread in.
		if (!workspacePath) return;
		const previous = this.#captureSelection();
		if (workspacePath !== this.selectedProjectPath) {
			this.selectedProjectPath = workspacePath;
			this.projectStatus = undefined;
		}
		const selectedIntegrations =
			integrations ??
			this.projects.find(({ path }) => path === this.selectedProjectPath)
				?.integrations ??
			[];
		this.activeDomains = selectedIntegrations.map(({ id }) => id);
		this.sessionId = undefined;
		this.messages = [];
		this.model = undefined;
		this.availableModels = [];
		this.thinkingLevels = [];
		this.sessionState = 'idle';
		this.usage = undefined;
		try {
			const sessionId = await this.#client.createSession({
				...(this.selectedProjectPath ? { cwd: this.selectedProjectPath } : {}),
				integrations: selectedIntegrations,
			});
			this.sessionId = sessionId;
			this.sessionStates[sessionId] = 'idle';
			const now = Date.now();
			this.sessions.unshift({
				id: sessionId,
				title: 'New session',
				...(this.selectedProjectPath
					? { workspacePath: this.selectedProjectPath }
					: {}),
				integrations: selectedIntegrations,
				createdAt: now,
				lastActiveAt: now,
				messageCount: 0,
			});
			await Promise.all([
				this.refreshModelCatalog(),
				this.#watchSelectedProject(),
			]);
		} catch (error) {
			this.#restoreSelection(previous);
			this.#fail('session', error);
		}
	}

	detectProject(projectPath: string): Promise<ProjectDomains> {
		return this.#client.detectProject(projectPath);
	}

	browseProjects(path?: string): Promise<WorkspaceDirectoryListing> {
		return this.#client.browseProjects(path);
	}

	async addProject(
		projectPath: string,
		integrations: WorkspaceIntegration[],
	): Promise<StoredProject> {
		const project = await this.#client.addProject(projectPath, integrations);
		this.projects = [
			project,
			...this.projects.filter(({ path }) => path !== project.path),
		];
		return project;
	}

	async saveProjectProfiles(
		projectPath: string,
		profiles: WorkspaceProfiles,
	): Promise<StoredProject> {
		const project = await this.#client.saveProjectProfiles(
			projectPath,
			profiles,
		);
		this.projects = this.projects.map((candidate) =>
			candidate.path === project.path ? project : candidate,
		);
		if (this.selectedProjectPath === project.path) {
			this.activeDomains = project.integrations.map(({ id }) => id);
		}
		return project;
	}

	/**
	 * Loads skills and the read-only Pi resources. Passing a workspace resolves
	 * each skill's effective state for that directory.
	 */
	async refreshResources(workspacePath?: string): Promise<void> {
		if (this.connection !== 'connected') return;
		this.resourcesLoading = true;
		this.resourceError = undefined;
		try {
			this.resources = await this.#client.listResources(workspacePath);
		} catch (error) {
			this.resourceError = errorMessage(error);
		} finally {
			this.resourcesLoading = false;
		}
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	): Promise<void> {
		this.resourceError = undefined;
		try {
			this.resources = await this.#client.setGlobalSkill(
				skillId,
				change,
				workspacePath,
			);
		} catch (error) {
			this.resourceError = errorMessage(error);
		}
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<void> {
		this.resourceError = undefined;
		try {
			this.resources = await this.#client.setProjectSkill(
				workspacePath,
				skillId,
				enabled,
			);
		} catch (error) {
			this.resourceError = errorMessage(error);
		}
	}

	async removeProject(projectPath: string): Promise<void> {
		await this.#client.removeProject(projectPath);
		this.projects = this.projects.filter(({ path }) => path !== projectPath);
	}

	/**
	 * Makes a workspace current without touching threads. Selecting a workspace
	 * and opening a thread are separate acts, so browsing never creates one.
	 */
	async selectWorkspace(projectPath: string): Promise<void> {
		if (this.selectedProjectPath === projectPath) return;
		this.#enterWorkspace(projectPath);
		await Promise.all([this.refreshProjectStatus(), this.refreshGitStatus()]);
	}

	/**
	 * Everything derived from a workspace flips in one synchronous step, so no
	 * panel can render another workspace's data and every loading flag is true
	 * before the first await yields a frame.
	 */
	#enterWorkspace(projectPath: string, domains?: string[]): void {
		this.selectedProjectPath = projectPath;
		this.projectStatus = undefined;
		this.gitStatus = undefined;
		this.projectError = undefined;
		this.projectExtensions = [];
		this.gitLoading = true;
		this.statusLoading = true;
		// The inspector follows the workspace in view, not the last thread's.
		this.activeDomains =
			domains ??
			this.projects
				.find(({ path }) => path === projectPath)
				?.integrations.map(({ id }) => id) ??
			[];
	}

	async switchSession(sessionId: string): Promise<void> {
		if (sessionId === this.sessionId) return;
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		if (!session) return;
		const previous = this.#captureSelection();
		this.sessionId = sessionId;
		this.messages = [];
		this.messagesLoading = true;
		this.sessionState = this.sessionStates[sessionId] ?? 'idle';
		this.usage = undefined;
		// The summary already knows where the thread lives, so the workspace can
		// follow now rather than after the transcript arrives.
		const summaryPath = session.workspacePath ?? session.projectPath;
		const movedWorkspace = Boolean(
			summaryPath && summaryPath !== this.selectedProjectPath,
		);
		if (movedWorkspace && summaryPath) {
			this.#enterWorkspace(
				summaryPath,
				session.integrations?.map(({ id }) => id),
			);
			void this.refreshGitStatus();
		}
		try {
			const snapshot = await this.#client.resumeSession(sessionId);
			this.messages = snapshot.messages;
			this.messagesLoading = false;
			Object.assign(session, snapshot.session);
			this.activeDomains =
				session.integrations?.map(({ id }) => id) ??
				(session.domainId && session.domainId !== 'generic'
					? [session.domainId]
					: []);
			const workspacePath = session.workspacePath ?? session.projectPath;
			if (workspacePath && workspacePath !== this.selectedProjectPath) {
				this.#enterWorkspace(workspacePath);
				void this.refreshGitStatus();
			}
			await Promise.all([
				this.refreshModelCatalog(),
				this.#watchSelectedProject(),
			]);
		} catch (error) {
			this.#restoreSelection(previous);
			this.#fail('session', error);
		} finally {
			if (this.sessionId === sessionId) this.messagesLoading = false;
		}
	}

	async readSession(sessionId: string): Promise<SessionSnapshot> {
		const activeSessionId = this.sessionId;
		try {
			return await this.#client.resumeSession(sessionId);
		} finally {
			if (activeSessionId && activeSessionId !== sessionId) {
				await this.#client.resumeSession(activeSessionId);
			}
		}
	}

	async refreshModelCatalog(): Promise<void> {
		if (!this.sessionId || this.connection !== 'connected') return;
		const sessionId = this.sessionId;
		this.modelLoading = true;
		try {
			const catalog = await this.#client.getModelCatalog(sessionId);
			if (this.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			if (this.sessionId === sessionId) this.#fail('session', error);
		} finally {
			if (this.sessionId === sessionId) this.modelLoading = false;
		}
	}

	async selectModel(provider: string, modelId: string): Promise<void> {
		if (
			!this.sessionId ||
			this.sessionState === 'streaming' ||
			this.modelLoading ||
			(this.model?.provider === provider && this.model.id === modelId)
		) {
			return;
		}
		await this.#selectCatalog((sessionId) =>
			this.#client.selectModel(sessionId, provider, modelId),
		);
	}

	async selectThinkingLevel(level: string): Promise<void> {
		if (
			!this.sessionId ||
			this.sessionState === 'streaming' ||
			this.modelLoading ||
			this.model?.thinkingLevel === level
		) {
			return;
		}
		await this.#selectCatalog((sessionId) =>
			this.#client.selectThinkingLevel(sessionId, level),
		);
	}

	async #selectCatalog(
		request: (sessionId: string) => Promise<AgentModelCatalog>,
	): Promise<void> {
		if (!this.sessionId) return;
		this.modelLoading = true;
		this.error = undefined;
		const sessionId = this.sessionId;
		try {
			const catalog = await request(sessionId);
			if (this.sessionId === sessionId) this.#applyModelCatalog(catalog);
		} catch (error) {
			this.#fail('session', error);
		} finally {
			this.modelLoading = false;
		}
	}

	async renameSession(sessionId: string, title: string): Promise<void> {
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		const name = title.trim();
		if (!session || !name) return;
		const previousTitle = session.title;
		session.title = name;
		try {
			await this.#client.renameSession(sessionId, name);
		} catch (error) {
			session.title = previousTitle;
			this.#fail('session', error);
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		if (
			this.isSessionStreaming(sessionId) ||
			!this.sessions.some((session) => session.id === sessionId)
		) {
			return;
		}
		try {
			await this.#client.deleteSession(sessionId);
		} catch (error) {
			this.#fail('session', error);
			return;
		}
		this.sessions = this.sessions.filter((session) => session.id !== sessionId);
		delete this.sessionStates[sessionId];
		if (this.sessionId !== sessionId) return;
		const next = this.sessions[0];
		if (next) await this.switchSession(next.id);
		else {
			this.sessionId = undefined;
			this.messages = [];
			await this.newSession();
		}
	}

	async disconnect(): Promise<void> {
		this.#autoReconnect = false;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = undefined;
		this.reconnectAttempt = 0;
		this.#cleanupSubscriptions();
		await this.#client.disconnect();
		this.connection = 'disconnected';
	}

	#cleanupSubscriptions(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		this.#unsubscribeDisconnect?.();
		this.#unsubscribeDisconnect = undefined;
	}

	async prompt(
		text: string,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		if (!this.sessionId || (!text.trim() && attachments.length === 0)) return;
		const sessionId = this.sessionId;
		const prompt = text.trim() || attachmentPrompt(attachments.length);
		this.error = undefined;
		this.lastPrompt = prompt;
		const session = this.sessions.find(
			(candidate) => candidate.id === sessionId,
		);
		if (session) {
			if (session.title === 'New session') session.title = sessionTitle(prompt);
			session.lastActiveAt = Date.now();
		}
		try {
			if (attachments.length) {
				await this.#client.prompt(
					sessionId,
					prompt,
					this.compactionPolicy,
					attachments,
				);
			} else {
				await this.#client.prompt(sessionId, prompt, this.compactionPolicy);
			}
		} catch (error) {
			this.sessionStates[sessionId] = 'error';
			if (this.sessionId === sessionId) this.#fail('prompt', error);
		}
	}

	async compact(): Promise<void> {
		if (!this.sessionId || this.compacting || this.sessionState === 'streaming')
			return;
		this.error = undefined;
		this.compacting = true;
		try {
			await this.#client.compact(this.sessionId, this.compactionPolicy);
			this.usage = undefined;
		} catch (error) {
			this.#fail('agent', error);
		} finally {
			this.compacting = false;
		}
	}

	/**
	 * Adds direction to the run already in flight. Unlike a prompt this does not
	 * wait for the agent to finish, which is the entire point of it.
	 */
	async steer(
		text: string,
		attachments: AgentAttachment[] = [],
	): Promise<void> {
		if (!this.sessionId || (!text.trim() && attachments.length === 0)) return;
		this.error = undefined;
		try {
			const prompt = text.trim() || attachmentPrompt(attachments.length);
			if (attachments.length) {
				await this.#client.steer(this.sessionId, prompt, attachments);
			} else await this.#client.steer(this.sessionId, prompt);
		} catch (error) {
			this.#fail('prompt', error);
		}
	}

	async revertFile(file: string, patch: string): Promise<void> {
		if (!this.selectedProjectPath) {
			throw new Error('No Unity project is selected');
		}
		await this.#client.revertFile(this.selectedProjectPath, file, patch);
	}

	async refreshGitStatus(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) return;
		const projectPath = this.selectedProjectPath;
		this.gitLoading = true;
		try {
			const status = await this.#client.getGitStatus(projectPath);
			if (this.selectedProjectPath === projectPath) this.gitStatus = status;
		} finally {
			if (this.selectedProjectPath === projectPath) this.gitLoading = false;
		}
	}

	async generateCommitMessage(): Promise<string> {
		if (!this.sessionId) throw new Error('No active session');
		if (!this.selectedProjectPath) throw new Error('No project selected');
		return this.#client.generateCommitMessage(
			this.sessionId,
			this.selectedProjectPath,
		);
	}

	async commitAll(message: string): Promise<GitCommitResult> {
		if (!this.selectedProjectPath) throw new Error('No project selected');
		this.gitCommitting = true;
		try {
			const result = await this.#client.commitAll(
				this.selectedProjectPath,
				message,
			);
			await this.refreshGitStatus();
			return result;
		} finally {
			this.gitCommitting = false;
		}
	}

	async loadProjectExtensions(): Promise<void> {
		if (this.connection !== 'connected' || !this.selectedProjectPath) return;
		const projectPath = this.selectedProjectPath;
		this.extensionsLoading = true;
		try {
			const result = await this.#client.listProjectExtensions(projectPath);
			if (this.selectedProjectPath === projectPath) {
				this.projectExtensions = result.extensions;
			}
		} catch (error) {
			if (this.selectedProjectPath === projectPath) {
				this.#fail('project', error);
			}
		} finally {
			if (this.selectedProjectPath === projectPath) {
				this.extensionsLoading = false;
			}
		}
	}

	async invokeProjectExtension(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	): Promise<unknown> {
		if (this.selectedProjectPath !== projectPath) {
			throw new Error('The extension project is no longer selected');
		}
		return this.#client.invokeProjectExtension(
			projectPath,
			extensionId,
			operation,
			input,
		);
	}

	/** The session as a tree, including branches this transcript does not walk. */
	async loadTree(): Promise<SessionTree | undefined> {
		if (!this.sessionId) return undefined;
		try {
			return await this.#client.getSessionTree(this.sessionId);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	/**
	 * Moves the thread back to an earlier entry. Nothing is deleted: the
	 * abandoned replies stay in the tree and can be returned to.
	 */
	async branchTo(entryId: string | null): Promise<boolean> {
		if (!this.sessionId || this.sessionState === 'streaming') return false;
		try {
			const snapshot = await this.#client.branchSession(
				this.sessionId,
				entryId,
			);
			this.messages = snapshot.messages;
			const session = this.sessions.find(
				(candidate) => candidate.id === snapshot.session.id,
			);
			if (session) session.messageCount = snapshot.session.messageCount;
			this.error = undefined;
			return true;
		} catch (error) {
			this.#fail('session', error);
			return false;
		}
	}

	async labelEntry(
		entryId: string,
		label?: string,
	): Promise<SessionTree | undefined> {
		if (!this.sessionId) return undefined;
		try {
			return await this.#client.labelEntry(this.sessionId, entryId, label);
		} catch (error) {
			this.#fail('session', error);
			return undefined;
		}
	}

	async abort(): Promise<void> {
		if (this.sessionId) await this.#client.abort(this.sessionId);
	}

	async resolveConfirmation(
		confirmation: PendingConfirmation,
		accepted: boolean,
	): Promise<void> {
		this.pendingConfirmations = this.pendingConfirmations.filter(
			(candidate) => candidate.confirmationId !== confirmation.confirmationId,
		);
		try {
			await this.#client.resolveConfirmation(
				confirmation.sessionId,
				confirmation.confirmationId,
				accepted,
			);
		} catch (error) {
			this.#fail('agent', error);
		}
	}

	isSessionStreaming(sessionId: string | undefined): boolean {
		return Boolean(sessionId && this.sessionStates[sessionId] === 'streaming');
	}

	async readAttachment(attachmentId: string) {
		if (!this.sessionId) throw new Error('No active session');
		return await this.#client.readAttachment(this.sessionId, attachmentId);
	}

	async revealAttachment(attachmentId: string): Promise<void> {
		if (!this.sessionId) throw new Error('No active session');
		await this.#client.revealAttachment(this.sessionId, attachmentId);
	}

	#receive(input: unknown): void {
		let event: AgentEvent;
		try {
			event = parseAgentEvent(input);
		} catch (error) {
			this.#fail('agent', error);
			return;
		}

		if (event.type === 'session.state') {
			this.sessionStates[event.sessionId] = event.state;
		} else if (event.type === 'error') {
			this.sessionStates[event.sessionId] = 'error';
		} else if (event.type === 'confirmation.requested') {
			this.pendingConfirmations.push(event);
			return;
		}
		if (this.sessionId && event.sessionId !== this.sessionId) return;

		const eventError = applyAgentEvent(this, event);
		if (eventError) this.error = { kind: 'agent', message: eventError };
	}

	async #watchSelectedProject(): Promise<void> {
		if (
			this.connection !== 'connected' ||
			!this.sessionId ||
			!this.selectedProjectPath
		) {
			this.projectStatus = undefined;
			this.projectExtensions = [];
			return;
		}
		if (!this.activeDomains.some((id) => extension(id)?.hasProjectStatus)) {
			this.projectStatus = undefined;
			await this.loadProjectExtensions();
			return;
		}
		const sessionId = this.sessionId;
		const projectPath = this.selectedProjectPath;
		this.projectExtensions = [];
		try {
			const [status] = await Promise.all([
				this.#client.watchProjectStatus(sessionId, projectPath),
				this.loadProjectExtensions(),
			]);
			if (
				this.sessionId === sessionId &&
				this.selectedProjectPath === projectPath
			) {
				this.projectStatus = status;
				this.projectError = undefined;
			}
		} catch (error) {
			if (
				this.sessionId === sessionId &&
				this.selectedProjectPath === projectPath
			) {
				this.projectError = errorMessage(error);
			}
		}
	}

	#fail(kind: AgentErrorKind, error: unknown): void {
		this.error = { kind, message: errorMessage(error) };
	}

	#captureSelection(): SessionSelection {
		return {
			sessionId: this.sessionId,
			sessionState: this.sessionState,
			messages: this.messages,
			messagesLoading: this.messagesLoading,
			model: this.model,
			availableModels: this.availableModels,
			thinkingLevels: this.thinkingLevels,
			activeDomains: this.activeDomains,
			selectedProjectPath: this.selectedProjectPath,
			projectStatus: this.projectStatus,
			usage: this.usage,
		};
	}

	#restoreSelection(selection: SessionSelection): void {
		this.sessionId = selection.sessionId;
		this.sessionState = selection.sessionState;
		this.messages = selection.messages;
		this.messagesLoading = selection.messagesLoading;
		this.model = selection.model;
		this.availableModels = selection.availableModels;
		this.thinkingLevels = selection.thinkingLevels;
		this.activeDomains = selection.activeDomains;
		this.selectedProjectPath = selection.selectedProjectPath;
		this.projectStatus = selection.projectStatus;
		this.usage = selection.usage;
	}

	#applyModelCatalog(catalog: AgentModelCatalog): void {
		this.availableModels = [...catalog.models];
		this.thinkingLevels = [...catalog.thinkingLevels];
		if (catalog.current) this.model = catalog.current;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function attachmentPrompt(count: number): string {
	return `Please inspect the attached ${count === 1 ? 'file' : 'files'}.`;
}
