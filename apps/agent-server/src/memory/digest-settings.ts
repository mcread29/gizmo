import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';
import type { DigestModelRef } from './digest-generator';

/**
 * How the journal's derived layer is produced.
 *
 * Global rather than per-project: the digest model is a property of which
 * providers the user has authenticated, not of any one repository, and a
 * per-project copy would mean re-choosing it for every workspace.
 */
export interface DigestSettings {
	/** Digest each segment as it is journaled. */
	auto: boolean;
	/** Absent until a model is chosen; nothing is digested without one. */
	model?: DigestModelRef;
}

export const defaultDigestSettings: DigestSettings = { auto: true };

export class DigestSettingsStore {
	readonly #file: string;

	constructor(dataDir = defaultDataDir()) {
		this.#file = join(dataDir, 'memory-digest.json');
	}

	async read(): Promise<DigestSettings> {
		let input: unknown;
		try {
			input = JSON.parse(await readFile(this.#file, 'utf8'));
		} catch (error) {
			// An unwritten or unreadable settings file means defaults, never a
			// failed turn: digesting is an enhancement to journaling, not a
			// precondition for it.
			return { ...defaultDigestSettings };
		}
		if (!input || typeof input !== 'object') {
			return { ...defaultDigestSettings };
		}
		const record = input as Record<string, unknown>;
		const model = modelRef(record.model);
		return {
			auto:
				typeof record.auto === 'boolean'
					? record.auto
					: defaultDigestSettings.auto,
			...(model ? { model } : {}),
		};
	}

	async write(settings: DigestSettings): Promise<void> {
		await mkdir(dirname(this.#file), { recursive: true });
		const temporary = `${this.#file}.tmp`;
		await writeFile(
			temporary,
			`${JSON.stringify(settings, null, '\t')}\n`,
			'utf8',
		);
		await rename(temporary, this.#file);
	}
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
