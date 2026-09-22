import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SettingsField } from '@gizmo/extension-api';
import { defaultDataDir } from '../sessions/session-repository';
import { validateSettingsValues } from './extension-settings-validate';

/** Everything in the file, versioned so a later shape can be migrated. */
interface StoredSettings {
	version: 1;
	extensions: Record<string, Record<string, unknown>>;
}

/**
 * The Pi agent directory Gizmo runs against: `PI_CODING_AGENT_DIR` when the
 * environment names one, otherwise the directory Gizmo points Pi at, which
 * is where its own `settings.json` lives.
 */
export function piAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	return configured
		? configured.replace(/^~(?=$|[\\/])/, homedir())
		: defaultDataDir();
}

/** Where every extension's settings are stored, for every workspace. */
export function extensionSettingsPath(): string {
	return join(piAgentDir(), 'extension-settings.json');
}

const empty = (): StoredSettings => ({ version: 1, extensions: {} });

/**
 * Extension settings as one global JSON file beside Pi's own settings. Values
 * are read by the server (views, commands, tools) and written by any client,
 * so they are never per-browser and never per-workspace.
 */
export class ExtensionSettingsStore {
	/** Serialises writes so two concurrent `set`s cannot lose one another. */
	#queue: Promise<unknown> = Promise.resolve();

	constructor(private readonly file: string = extensionSettingsPath()) {}

	/** The whole file. A missing or corrupt file reads as empty. */
	async read(): Promise<StoredSettings> {
		try {
			const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
			if (!parsed || typeof parsed !== 'object') return empty();
			const extensions = (parsed as StoredSettings).extensions;
			if (!extensions || typeof extensions !== 'object') return empty();
			const result = empty();
			for (const [id, values] of Object.entries(extensions)) {
				if (values && typeof values === 'object' && !Array.isArray(values))
					result.extensions[id] = { ...(values as Record<string, unknown>) };
			}
			return result;
		} catch {
			// A truncated or hand-edited file must not take the server down.
			return empty();
		}
	}

	/** One extension's stored values. */
	async get(extensionId: string): Promise<Record<string, unknown>> {
		return (await this.read()).extensions[extensionId] ?? {};
	}

	/**
	 * Merges `values` into the extension's settings and returns what is
	 * stored afterwards. A `null` (or `undefined`) value clears its key;
	 * every other value is checked against `fields`.
	 */
	async set(
		extensionId: string,
		values: Record<string, unknown>,
		fields: readonly SettingsField[],
	): Promise<Record<string, unknown>> {
		const changes = validateSettingsValues(extensionId, values, fields);
		return this.#write(async (stored) => {
			const next = { ...(stored.extensions[extensionId] ?? {}) };
			for (const [key, value] of Object.entries(changes)) {
				if (value === undefined) delete next[key];
				else next[key] = value;
			}
			if (Object.keys(next).length) stored.extensions[extensionId] = next;
			else delete stored.extensions[extensionId];
			return next;
		});
	}

	/** Forgets everything stored for an extension. */
	async clear(extensionId: string): Promise<Record<string, unknown>> {
		return this.#write(async (stored) => {
			delete stored.extensions[extensionId];
			return {};
		});
	}

	async #write<T>(apply: (stored: StoredSettings) => Promise<T>): Promise<T> {
		const run = this.#queue.then(async () => {
			const stored = await this.read();
			const result = await apply(stored);
			await this.#save(stored);
			return result;
		});
		// Keep the chain alive even when a caller's write rejects.
		this.#queue = run.catch(() => undefined);
		return run;
	}

	/** Atomic: write a sibling temp file, then rename it over the target. */
	async #save(stored: StoredSettings): Promise<void> {
		await mkdir(join(this.file, '..'), { recursive: true });
		const temporary = `${this.file}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporary, `${JSON.stringify(stored, null, 2)}\n`, {
				mode: 0o600,
			});
			await rename(temporary, this.file);
		} catch (error) {
			await rm(temporary, { force: true });
			throw error;
		}
	}
}

/** The server's one store; tests build their own against a temp file. */
export const extensionSettings = new ExtensionSettingsStore();
