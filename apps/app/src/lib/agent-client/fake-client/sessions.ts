import {
	agentToolPolicy,
	sessionTitle,
	type AgentModelCatalog,
	type SessionOptions,
} from '@gizmo/protocol';
import { fakeModels, fakeProviders, fakeThinkingLevels } from './fixtures';
import type { FakeSession } from './state';
import { FakeClientState } from './state';
import type { FakeToolPolicyCapability } from './tool-policy';

export class FakeSessionCapability {
	constructor(
		private readonly state: FakeClientState,
		private readonly tools: FakeToolPolicyCapability,
	) {}

	async listProviders() {
		this.state.assertConnected();
		return fakeProviders;
	}

	async reimportPiAuth() {
		this.state.assertConnected();
		return fakeProviders;
	}

	async list() {
		this.state.assertConnected();
		return {
			sessions: [...this.state.sessions.values()]
				.map(({ summary }) => ({ ...summary }))
				.sort((left, right) => right.lastActiveAt - left.lastActiveAt),
			...(this.state.lastSessionId
				? { lastSessionId: this.state.lastSessionId }
				: {}),
		};
	}

	async create(options: SessionOptions = {}) {
		this.state.assertConnected();
		const sessionId = this.state.nextId('session');
		const now = Date.now();
		const session: FakeSession = {
			running: false,
			model: { provider: 'openai-codex', id: 'gpt-5.6-sol' },
			thinkingLevel: 'high',
			summary: {
				id: sessionId,
				title: 'New session',
				workspacePath: options.cwd ?? this.state.projects[0]!.path,
				integrations: options.cwd
					? (this.state.projects.find(({ path }) => path === options.cwd)
							?.integrations ?? [])
					: [{ id: 'unity', root: '.' }],
				createdAt: now,
				lastActiveAt: now,
				messageCount: 0,
			},
			messages: [],
			labels: new Map(),
		};
		this.state.sessions.set(sessionId, session);
		this.state.lastSessionId = sessionId;
		this.emitCreated(session);
		return sessionId;
	}

	async resume(sessionId: string) {
		const session = this.state.getSession(sessionId);
		this.state.lastSessionId = sessionId;
		this.emitCreated(session);
		return this.snapshot(session);
	}

	async tree(sessionId: string) {
		const session = this.state.getSession(sessionId);
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

	async branch(sessionId: string, entryId: string | null) {
		const session = this.state.getSession(sessionId);
		const index =
			entryId === null
				? -1
				: session.messages.findIndex((message) => message.id === entryId);
		if (entryId !== null && index < 0) {
			throw new Error(`Unknown entry: ${entryId}`);
		}
		session.messages = session.messages.slice(0, index + 1);
		session.summary.messageCount = session.messages.length;
		return this.snapshot(session);
	}

	async label(sessionId: string, entryId: string, label?: string) {
		const session = this.state.getSession(sessionId);
		if (label?.trim()) session.labels.set(entryId, label.trim());
		else session.labels.delete(entryId);
		return this.tree(sessionId);
	}

	async rename(sessionId: string, title: string) {
		this.state.getSession(sessionId).summary.title = title.trim();
	}

	async compact(sessionId: string) {
		this.state.getSession(sessionId);
	}

	async listCommands(sessionId: string) {
		this.state.getSession(sessionId);
		return this.state.commands.map((command) => ({ ...command }));
	}

	async reload(sessionId: string) {
		this.state.getSession(sessionId);
	}

	async abort(sessionId: string) {
		this.state.getSession(sessionId).abortController?.abort();
	}

	async delete(sessionId: string) {
		const session = this.state.getSession(sessionId);
		session.abortController?.abort();
		this.state.sessions.delete(sessionId);
		if (this.state.lastSessionId === sessionId) {
			this.state.lastSessionId = undefined;
		}
	}

	async modelCatalog(sessionId: string) {
		return this.catalog(this.state.getSession(sessionId));
	}

	async selectModel(sessionId: string, provider: string, modelId: string) {
		const session = this.state.getSession(sessionId);
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
		return this.catalog(session);
	}

	async selectThinkingLevel(sessionId: string, level: string) {
		const session = this.state.getSession(sessionId);
		if (session.running) {
			throw new Error('Cannot change thinking level while streaming');
		}
		if (!fakeThinkingLevels.includes(level)) {
			throw new Error(`Unsupported thinking level: ${level}`);
		}
		session.thinkingLevel = level;
		return this.catalog(session);
	}

	setTitleFromPrompt(session: FakeSession, text: string) {
		if (session.summary.title === 'New session') {
			session.summary.title = sessionTitle(text);
		}
	}

	private snapshot(session: FakeSession) {
		return {
			session: { ...session.summary },
			messages: structuredClone(session.messages),
		};
	}

	private catalog(session: FakeSession): AgentModelCatalog {
		return {
			current: { ...session.model, thinkingLevel: session.thinkingLevel },
			models: fakeModels,
			thinkingLevels: fakeThinkingLevels,
		};
	}

	private emitCreated(session: FakeSession) {
		this.state.emit({
			type: 'session.created',
			sessionId: session.summary.id,
			title: session.summary.title,
			model: { ...session.model, thinkingLevel: session.thinkingLevel },
			tools: [
				...this.tools.catalog(session.summary.workspacePath ?? undefined)
					.effective,
				...agentToolPolicy.tools.filter((tool) => tool === 'git_status'),
			],
			domains: session.summary.integrations?.map(({ id }) => id) ?? [],
		});
		this.state.emit({
			type: 'session.state',
			sessionId: session.summary.id,
			state: 'idle',
		});
	}
}
