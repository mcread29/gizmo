import {
	SessionManager,
	type SessionEntry,
	type SessionInfo,
	type SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type {
	AgentSessionSummary,
	ConversationMessage,
	SessionCatalog,
	SessionSnapshot,
	SessionTree,
	SessionTreeEntry,
	ToolCallView,
} from '@unity-agent/protocol';
import {
	mkdir,
	readFile,
	rename,
	rm,
	unlink,
	writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalizeToolResult, toolResultIsError } from './tool-result';

export interface SessionRepository {
	create(projectPath: string): Promise<SessionManager>;
	open(sessionId: string): Promise<SessionManager>;
	list(): Promise<SessionCatalog>;
	snapshot(sessionId: string): Promise<SessionSnapshot>;
	snapshotOf(
		manager: SessionManager,
		sessionId: string,
	): Promise<SessionSnapshot>;
	rename(sessionId: string, title: string): Promise<void>;
	delete(sessionId: string): Promise<void>;
	setLastSession(sessionId?: string): Promise<void>;
}

export class PiSessionRepository implements SessionRepository {
	readonly #dataDir: string;
	readonly #sessionDir: string;
	readonly #workspaceFile: string;

	constructor(dataDir = defaultDataDir()) {
		this.#dataDir = dataDir;
		this.#sessionDir = join(dataDir, 'sessions');
		this.#workspaceFile = join(dataDir, 'workspace.json');
	}

	async create(projectPath: string): Promise<SessionManager> {
		await mkdir(this.#sessionDir, { recursive: true });
		const pending = SessionManager.create(projectPath, this.#sessionDir);
		pending.appendSessionInfo('New session');
		const sessionFile = pending.getSessionFile();
		const header = pending.getHeader();
		if (!sessionFile || !header)
			throw new Error('Pi did not create a session file');
		await writeFile(
			sessionFile,
			`${[header, ...pending.getEntries()].map((entry) => JSON.stringify(entry)).join('\n')}\n`,
			{ encoding: 'utf8', flag: 'wx' },
		);
		return SessionManager.open(sessionFile, this.#sessionDir);
	}

	async open(sessionId: string): Promise<SessionManager> {
		const info = await this.#find(sessionId);
		return SessionManager.open(info.path, this.#sessionDir);
	}

	async list(): Promise<SessionCatalog> {
		await mkdir(this.#sessionDir, { recursive: true });
		const sessions = (await SessionManager.listAll(this.#sessionDir))
			.map(toSummary)
			.sort((left, right) => right.lastActiveAt - left.lastActiveAt);
		const lastSessionId = await this.#readLastSessionId();
		return {
			sessions,
			...(lastSessionId && sessions.some(({ id }) => id === lastSessionId)
				? { lastSessionId }
				: {}),
		};
	}

	async snapshot(sessionId: string): Promise<SessionSnapshot> {
		const info = await this.#find(sessionId);
		const manager = SessionManager.open(info.path, this.#sessionDir);
		return {
			session: toSummary(info),
			messages: transcript(manager),
		};
	}

	/**
	 * Snapshot of a manager the caller already holds. Branching moves the leaf
	 * on the live manager, so re-opening the file would read the old position.
	 */
	async snapshotOf(
		manager: SessionManager,
		sessionId: string,
	): Promise<SessionSnapshot> {
		const info = await this.#find(sessionId);
		return { session: toSummary(info), messages: transcript(manager) };
	}

	async rename(sessionId: string, title: string): Promise<void> {
		const manager = await this.open(sessionId);
		manager.appendSessionInfo(title);
	}

	async delete(sessionId: string): Promise<void> {
		const info = await this.#find(sessionId);
		await unlink(info.path);
		await rm(join(this.#sessionDir, 'attachments', sessionId), {
			recursive: true,
			force: true,
		});
		const current = await this.#readLastSessionId();
		if (current === sessionId) await this.setLastSession();
	}

	async setLastSession(sessionId?: string): Promise<void> {
		await mkdir(this.#dataDir, { recursive: true });
		const temporaryFile = `${this.#workspaceFile}.tmp`;
		await writeFile(
			temporaryFile,
			`${JSON.stringify({ ...(sessionId ? { lastSessionId: sessionId } : {}) }, null, 2)}\n`,
			'utf8',
		);
		await rename(temporaryFile, this.#workspaceFile);
	}

	async #find(sessionId: string): Promise<SessionInfo> {
		const sessions = await SessionManager.listAll(this.#sessionDir);
		const info = sessions.find((session) => session.id === sessionId);
		if (!info) throw new Error(`Unknown session: ${sessionId}`);
		return info;
	}

	async #readLastSessionId(): Promise<string | undefined> {
		try {
			const value = JSON.parse(await readFile(this.#workspaceFile, 'utf8')) as {
				lastSessionId?: unknown;
			};
			return typeof value.lastSessionId === 'string'
				? value.lastSessionId
				: undefined;
		} catch (error) {
			if (isMissingFile(error)) return;
			throw error;
		}
	}
}

/**
 * The session as pi records it: every entry, including the branches the
 * current transcript does not walk.
 */
export function sessionTree(manager: SessionManager): SessionTree {
	const entries: SessionTreeEntry[] = [];
	for (const entry of manager.getEntries()) {
		const view = treeEntry(entry, manager.getLabel(entry.id));
		if (view) entries.push(view);
	}
	return { entries, leafId: manager.getLeafId() };
}

function treeEntry(
	entry: SessionEntry,
	label: string | undefined,
): SessionTreeEntry | undefined {
	const base = {
		id: entry.id,
		parentId: entry.parentId,
		createdAt: Date.parse(entry.timestamp) || 0,
		...(label ? { label } : {}),
	};
	if (entry.type === 'message') {
		const message = (entry as SessionMessageEntry).message;
		if (message.role === 'toolResult') return undefined;
		if (message.role === 'user') {
			const text = textContent(message.content);
			return { ...base, kind: 'user', summary: oneLine(text), detail: text };
		}
		if (message.role === 'assistant') {
			const text = textContent(message.content);
			const tools = message.content
				.filter((content) => content.type === 'toolCall')
				.map((toolCall) => toolCall.name);
			return {
				...base,
				kind: tools.length && !text ? 'tool' : 'assistant',
				summary: oneLine(text) || tools.join(', ') || 'No output',
				...(text ? { detail: text } : {}),
			};
		}
		return undefined;
	}
	if (entry.type === 'compaction') {
		return { ...base, kind: 'compaction', summary: 'Compacted' };
	}
	if (entry.type === 'branch_summary') {
		return { ...base, kind: 'branch-summary', summary: 'Branch summary' };
	}
	if (entry.type === 'model_change') {
		return {
			...base,
			kind: 'model-change',
			summary: `Model: ${entry.provider}/${entry.modelId}`,
		};
	}
	if (entry.type === 'thinking_level_change') {
		return {
			...base,
			kind: 'thinking-change',
			summary: `Thinking: ${entry.thinkingLevel}`,
		};
	}
	return undefined;
}

function oneLine(text: string): string {
	const line = text.replace(/\s+/g, ' ').trim();
	return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

export function defaultDataDir(): string {
	return process.env.UNITY_AGENT_DATA_DIR ?? join(homedir(), '.unity-agent');
}

function toSummary(info: SessionInfo): AgentSessionSummary {
	return {
		id: info.id,
		title: info.name?.trim() || titleFromFirstMessage(info.firstMessage),
		...(info.cwd ? { projectPath: info.cwd } : {}),
		createdAt: info.created.getTime(),
		lastActiveAt: info.modified.getTime(),
		messageCount: info.messageCount,
	};
}

/**
 * Recorded arguments for a tool call. The key has varied across transcript
 * formats, so every spelling that has been used is accepted rather than
 * dropping the arguments of older threads.
 */
function toolCallInput(toolCall: unknown): unknown {
	if (!toolCall || typeof toolCall !== 'object') return undefined;
	const record = toolCall as Record<string, unknown>;
	for (const key of ['args', 'arguments', 'input', 'parameters']) {
		if (record[key] !== undefined) return record[key];
	}
	return undefined;
}

function titleFromFirstMessage(message: string): string {
	const title = message.trim();
	if (!title) return 'New session';
	return title.length > 48 ? `${title.slice(0, 47)}…` : title;
}

function transcript(manager: SessionManager): ConversationMessage[] {
	const messages: ConversationMessage[] = [];
	const tools = new Map<string, ToolCallView>();

	for (const entry of manager.getBranch()) {
		if (entry.type !== 'message') continue;
		const message = (entry as SessionMessageEntry).message;
		if (message.role === 'user') {
			messages.push({
				id: entry.id,
				role: 'user',
				content: textContent(message.content),
				createdAt: message.timestamp,
				complete: true,
				tools: [],
			});
			continue;
		}
		if (message.role === 'assistant') {
			const messageTools = message.content
				.filter((content) => content.type === 'toolCall')
				.map((toolCall) => {
					const input = toolCallInput(toolCall);
					const tool: ToolCallView = {
						id: toolCall.id,
						name: toolCall.name,
						status: 'running',
						statusText: 'Starting',
						...(input === undefined ? {} : { input }),
					};
					tools.set(tool.id, tool);
					return tool;
				});
			const reasoning = reasoningContent(message.content);
			messages.push({
				id: entry.id,
				role: 'assistant',
				content: textContent(message.content),
				...(reasoning.text ? { reasoning: reasoning.text } : {}),
				...(reasoning.redacted ? { reasoningRedacted: true } : {}),
				createdAt: message.timestamp,
				complete: true,
				tools: messageTools,
			});
			continue;
		}
		if (message.role === 'toolResult') {
			const tool = tools.get(message.toolCallId);
			if (!tool) continue;
			const rawResult = {
				content: message.content,
				details: message.details,
			};
			const isError = message.isError || toolResultIsError(rawResult);
			tool.status = isError ? 'error' : 'complete';
			tool.statusText = isError ? 'Failed' : 'Completed';
			tool.result = normalizeToolResult(rawResult);
		}
	}

	return messages;
}

function textContent(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((item): item is { type: 'text'; text: string } =>
			Boolean(
				item &&
				typeof item === 'object' &&
				'type' in item &&
				item.type === 'text' &&
				'text' in item &&
				typeof item.text === 'string',
			),
		)
		.map((item) => item.text)
		.join('');
}

/**
 * Reasoning recorded alongside the reply. Providers that withhold their
 * reasoning still record a block, so the redacted flag is reported separately
 * from the text and either can be present on its own.
 */
function reasoningContent(content: unknown): {
	text: string;
	redacted: boolean;
} {
	if (!Array.isArray(content)) return { text: '', redacted: false };
	const blocks = content.filter(
		(item): item is { thinking?: unknown; redacted?: unknown } =>
			Boolean(
				item &&
				typeof item === 'object' &&
				'type' in item &&
				item.type === 'thinking',
			),
	);
	return {
		text: blocks
			.map((block) =>
				typeof block.thinking === 'string' ? block.thinking : '',
			)
			.filter(Boolean)
			.join('\n\n'),
		redacted: blocks.some((block) => block.redacted === true),
	};
}

function isMissingFile(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT'
	);
}
