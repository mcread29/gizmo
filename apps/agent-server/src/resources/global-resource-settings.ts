import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';

/**
 * Global resource state. Skills are installed globally by default so a skill
 * is managed in one place, while enablement stays opt-in so installing one
 * never silently changes how sessions behave.
 */
export interface GlobalResourceSettings {
	installedSkills: string[];
	enabledSkills: string[];
	/** Explicitly uninstalled, so discovery does not reinstall them. */
	uninstalledSkills: string[];
	/** Installed Gizmo extensions switched off globally; absent means on. */
	disabledGizmoExtensions: string[];
}

export const emptyGlobalResourceSettings: GlobalResourceSettings = {
	installedSkills: [],
	enabledSkills: [],
	uninstalledSkills: [],
	disabledGizmoExtensions: [],
};

export class GlobalResourceStore {
	readonly #file: string;

	constructor(dataDir = defaultDataDir()) {
		this.#file = join(dataDir, 'resources.json');
	}

	async read(): Promise<GlobalResourceSettings> {
		try {
			const input = JSON.parse(await readFile(this.#file, 'utf8')) as unknown;
			return {
				installedSkills: strings(input, 'installedSkills'),
				enabledSkills: strings(input, 'enabledSkills'),
				uninstalledSkills: strings(input, 'uninstalledSkills'),
				disabledGizmoExtensions: strings(input, 'disabledGizmoExtensions'),
			};
		} catch (error) {
			if (missing(error)) return { ...emptyGlobalResourceSettings };
			throw error;
		}
	}

	async write(settings: GlobalResourceSettings): Promise<void> {
		await mkdir(dirname(this.#file), { recursive: true });
		const temporary = `${this.#file}.tmp`;
		await writeFile(temporary, `${JSON.stringify(settings, null, '\t')}\n`);
		await rename(temporary, this.#file);
	}
}

function strings(input: unknown, key: string): string[] {
	const value = (input as Record<string, unknown> | null)?.[key];
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((item) => typeof item === 'string'))];
}

function missing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}
