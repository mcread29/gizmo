import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';
import type { DigestModelRef } from './digest-generator';

/**
 * How the journal's derived layer is produced, for one workspace.
 *
 * This is the effective view: whatever the project overrides, over whatever
 * the default says.
 */
export interface DigestSettings {
	/** Digest each segment as it is journaled. */
	auto: boolean;
	/** Absent until a model is chosen; nothing is digested without one. */
	model?: DigestModelRef;
}

/**
 * What one project overrides. A key that is absent inherits the default,
 * which is why `model` distinguishes three states rather than two: absent is
 * "inherit", null is "digesting is off here", and a ref is that model. A
 * plain optional could not say "off" without also meaning "unset".
 */
export interface DigestOverride {
	auto?: boolean;
	model?: DigestModelRef | null;
}

export const defaultDigestSettings: DigestSettings = { auto: true };

/**
 * Settings live in one file in the data directory, with per-project overrides
 * keyed by workspace path.
 *
 * Deliberately not stored inside the project beside its journal, even though
 * the digests themselves are: a workspace path is machine-specific, so a
 * file synced between machines would key its overrides on paths that do not
 * exist on the other one. The default travels as a setting; the override
 * belongs to this machine's view of that checkout.
 */
export class DigestSettingsStore {
	readonly #file: string;

	constructor(dataDir = defaultDataDir()) {
		this.#file = join(dataDir, 'memory-digest.json');
	}

	/** The settings a workspace actually runs under. */
	async read(workspacePath?: string): Promise<DigestSettings> {
		const file = await this.#readFile();
		const override = workspacePath ? file.projects[workspacePath] : undefined;
		if (!override)
			return { auto: file.auto, ...(file.model ? { model: file.model } : {}) };
		const model = 'model' in override ? override.model : file.model;
		return {
			auto: override.auto ?? file.auto,
			...(model ? { model } : {}),
		};
	}

	/** The default a workspace falls back to, for the UI to name. */
	async readDefault(): Promise<DigestSettings> {
		const file = await this.#readFile();
		return { auto: file.auto, ...(file.model ? { model: file.model } : {}) };
	}

	/** What this workspace overrides, or undefined while it inherits in full. */
	async readOverride(
		workspacePath: string,
	): Promise<DigestOverride | undefined> {
		const file = await this.#readFile();
		return file.projects[workspacePath];
	}

	/** Writes the default every workspace falls back to. */
	async writeDefault(settings: DigestSettings): Promise<void> {
		const file = await this.#readFile();
		await this.#write({
			...file,
			auto: settings.auto,
			...(settings.model ? { model: settings.model } : { model: undefined }),
		});
	}

	/** Writes one workspace's override, or clears it so it inherits again. */
	async writeOverride(
		workspacePath: string,
		override: DigestOverride | undefined,
	): Promise<void> {
		const file = await this.#readFile();
		const projects = { ...file.projects };
		if (override) projects[workspacePath] = override;
		else delete projects[workspacePath];
		await this.#write({ ...file, projects });
	}

	async #readFile(): Promise<StoredSettings> {
		let input: unknown;
		try {
			input = JSON.parse(await readFile(this.#file, 'utf8'));
		} catch {
			// An unwritten or unreadable settings file means defaults, never a
			// failed turn: digesting is an enhancement to journaling, not a
			// precondition for it.
			return { ...defaultDigestSettings, projects: {} };
		}
		if (!input || typeof input !== 'object') {
			return { ...defaultDigestSettings, projects: {} };
		}
		const record = input as Record<string, unknown>;
		const model = modelRef(record.model);
		return {
			auto:
				typeof record.auto === 'boolean'
					? record.auto
					: defaultDigestSettings.auto,
			...(model ? { model } : {}),
			projects: overrides(record.projects),
		};
	}

	async #write(settings: StoredSettings): Promise<void> {
		await mkdir(dirname(this.#file), { recursive: true });
		const temporary = `${this.#file}.tmp`;
		const body = {
			auto: settings.auto,
			...(settings.model ? { model: settings.model } : {}),
			...(Object.keys(settings.projects).length > 0
				? { projects: settings.projects }
				: {}),
		};
		await writeFile(temporary, `${JSON.stringify(body, null, '\t')}\n`, 'utf8');
		await rename(temporary, this.#file);
	}
}

interface StoredSettings extends DigestSettings {
	projects: Record<string, DigestOverride>;
}

function overrides(value: unknown): Record<string, DigestOverride> {
	if (!value || typeof value !== 'object') return {};
	const result: Record<string, DigestOverride> = {};
	for (const [path, raw] of Object.entries(value as Record<string, unknown>)) {
		if (!raw || typeof raw !== 'object') continue;
		const record = raw as Record<string, unknown>;
		const override: DigestOverride = {};
		if (typeof record.auto === 'boolean') override.auto = record.auto;
		// null is meaningful here and must survive the round trip.
		if ('model' in record) {
			override.model = record.model === null ? null : modelRef(record.model);
			if (override.model === undefined) delete override.model;
		}
		if (Object.keys(override).length > 0) result[path] = override;
	}
	return result;
}

function modelRef(value: unknown): DigestModelRef | undefined {
	if (!value || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	const provider = record.provider;
	const id = record.id;
	if (typeof provider !== 'string' || !provider) return;
	if (typeof id !== 'string' || !id) return;
	return { provider, id };
}
