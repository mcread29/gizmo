import {
	SessionManager,
	type SessionInfo,
} from '@earendil-works/pi-coding-agent';
import type {
	AgentSessionSummary,
	SessionCatalog,
	SessionSnapshot,
} from '@gizmo/protocol';
import { sessionTitle } from '@gizmo/protocol';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { sessionTranscript } from './session-transcript';

export interface SessionRepository {
	create(workspacePath: string): Promise<SessionManager>;
	open(sessionId: string): Promise<SessionManager>;
	list(): Promise<SessionCatalog>;
	snapshot(sessionId: string): Promise<SessionSnapshot>;
	snapshotOf(
		manager: SessionManager,
		sessionId: string,
	): Promise<SessionSnapshot>;
	rename(sessionId: string, title: string): Promise<void>;
	/** Archives rather than erases: history stays on disk, out of the catalog. */
	delete(sessionId: string): Promise<void>;
	setLastSession(sessionId?: string): Promise<void>;
}

export class PiSessionRepository implements SessionRepository {
	readonly #dataDir: string;
	readonly #sessionDir: string;
	readonly #archiveDir: string;
	readonly #workspaceFile: string;

	constructor(dataDir = defaultDataDir()) {
		this.#dataDir = dataDir;
		this.#sessionDir = join(dataDir, 'sessions');
		this.#archiveDir = join(dataDir, 'sessions', 'archived');
		this.#workspaceFile = join(dataDir, 'workspace.json');
	}

	async create(workspacePath: string): Promise<SessionManager> {
		await mkdir(this.#sessionDir, { recursive: true });
		const pending = SessionManager.create(workspacePath, this.#sessionDir);
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
			messages: sessionTranscript(manager),
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
		return { session: toSummary(info), messages: sessionTranscript(manager) };
	}

	async rename(sessionId: string, title: string): Promise<void> {
		const manager = await this.open(sessionId);
		manager.appendSessionInfo(title);
	}

	/**
	 * Hides a session without destroying it. The transcript is the authoritative
	 * record behind derived memory, so removal moves the file into
	 * `sessions/archived/` — outside the non-recursive directory scan
	 * `SessionManager.listAll` performs — instead of unlinking it.
	 */
	async delete(sessionId: string): Promise<void> {
		const info = await this.#find(sessionId);
		await mkdir(this.#archiveDir, { recursive: true });
		await rename(info.path, join(this.#archiveDir, basename(info.path)));
		await this.#archiveAttachments(sessionId);
		const current = await this.#readLastSessionId();
		if (current === sessionId) await this.setLastSession();
	}

	/** Attachments follow the transcript so an archived session stays whole. */
	async #archiveAttachments(sessionId: string): Promise<void> {
		const source = join(this.#sessionDir, 'attachments', sessionId);
		const target = join(this.#archiveDir, 'attachments', sessionId);
		try {
			await mkdir(dirname(target), { recursive: true });
			await rename(source, target);
		} catch (error) {
			// A session with no attachments has no directory to move.
			if (!isMissingFile(error)) throw error;
		}
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

export function defaultDataDir(): string {
	return process.env.GIZMO_DATA_DIR ?? join(homedir(), '.gizmo');
}

function toSummary(info: SessionInfo): AgentSessionSummary {
	return {
		id: info.id,
		title: info.name?.trim() || sessionTitle(info.firstMessage),
		...(info.cwd ? { workspacePath: info.cwd } : {}),
		createdAt: info.created.getTime(),
		lastActiveAt: info.modified.getTime(),
		messageCount: info.messageCount,
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
