import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
	type ExtensionOverride,
	type ProjectConfig,
	type ProjectSkill,
	type WorkspaceIntegration,
} from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { listPiExtensions } from '../resources/pi-global-resources';
import { AsyncMutex } from './async-mutex';

/** Owns project config normalization, persistence, validation, and migration. */
export class ProjectConfigStore {
	readonly #mutexes = new Map<string, AsyncMutex>();

	async read(projectPath: string): Promise<ProjectConfig> {
		const path = resolve(projectPath);
		const config = await readConfig(path);
		if (config) return config;
		return (await this.#migrateLegacyProfiles(path)) ?? { version: 1 };
	}

	async update(
		projectPath: string,
		update: (config: ProjectConfig) => ProjectConfig,
	) {
		const path = resolve(projectPath);
		return this.#mutex(path).run(async () => {
			let config = await readConfig(path);
			if (!config) {
				config = (await migrateLegacyProfiles(path)) ?? { version: 1 };
			}
			config = normalizeConfig(update(config));
			await validateConfig(config);
			await writeConfig(path, config);
			return config;
		});
	}

	async #migrateLegacyProfiles(path: string) {
		const config = await legacyConfig(path);
		if (!config) return null;
		return this.#mutex(path).run(async () => {
			await persistMigration(path, config);
			return config;
		});
	}

	#mutex(projectPath: string) {
		const key = resolve(projectPath);
		let mutex = this.#mutexes.get(key);
		if (!mutex) {
			mutex = new AsyncMutex();
			this.#mutexes.set(key, mutex);
		}
		return mutex;
	}
}

export function withOverride(
	rows: ExtensionOverride[],
	id: string,
	enabled: boolean | null,
) {
	const rest = rows.filter((row) => row.id !== id);
	if (enabled === null) return rest;
	return [...rest, { id, enabled }].sort((left, right) =>
		left.id.localeCompare(right.id),
	);
}

async function readConfig(projectPath: string) {
	try {
		return normalizeConfig(
			JSON.parse(await readFile(configFile(projectPath), 'utf8')),
		);
	} catch (error) {
		if (missing(error)) return null;
		throw error;
	}
}

/** Removes empty sections and duplicate rows so stored files stay minimal. */
function normalizeConfig(input: unknown): ProjectConfig {
	const candidate = input as Partial<ProjectConfig>;
	const overrides = (rows?: ExtensionOverride[]) => {
		const byId = new Map<string, ExtensionOverride>();
		for (const override of rows ?? []) {
			if (
				typeof override?.id === 'string' &&
				typeof override.enabled === 'boolean'
			) {
				byId.set(override.id, {
					id: override.id,
					enabled: override.enabled,
				});
			}
		}
		return [...byId.values()].sort((left, right) =>
			left.id.localeCompare(right.id),
		);
	};
	const skills = overrides(candidate.skills).map(({ id, enabled }) => ({
		id,
		enabled,
	}));
	const gizmoExtensions = overrides(candidate.gizmoExtensions);
	const piExtensions = overrides(candidate.piExtensions);
	return {
		version: 1,
		...(gizmoExtensions.length ? { gizmoExtensions } : {}),
		...(piExtensions.length ? { piExtensions } : {}),
		...(skills.length ? { skills } : {}),
	};
}

async function validateConfig(config: ProjectConfig) {
	if (config.version !== 1) {
		throw new Error(
			`Unsupported project configuration version: ${config.version}`,
		);
	}
	const gizmoIds = new Set(registeredExtensions().map(({ id }) => id));
	for (const { id } of config.gizmoExtensions ?? []) {
		if (!gizmoIds.has(id)) throw new Error(`Unknown Gizmo extension: ${id}`);
	}
	const piIds = new Set((await listPiExtensions()).map(({ id }) => id));
	for (const { id } of config.piExtensions ?? []) {
		if (!piIds.has(id)) throw new Error(`Unknown Pi extension: ${id}`);
	}
}

async function migrateLegacyProfiles(projectPath: string) {
	const config = await legacyConfig(projectPath);
	if (!config) return null;
	await persistMigration(projectPath, config);
	return config;
}

async function legacyConfig(
	projectPath: string,
): Promise<ProjectConfig | null> {
	try {
		const stored = JSON.parse(
			await readFile(legacyFile(projectPath), 'utf8'),
		) as {
			activeProfileId?: string;
			profiles?: LegacyProfile[];
		};
		const profiles = stored.profiles ?? [];
		const active =
			profiles.find(({ id }) => id === stored.activeProfileId) ??
			profiles[0] ??
			{};
		const enabled = new Set((active.extensions ?? []).map(({ id }) => id));
		return {
			version: 1,
			gizmoExtensions: registeredExtensions().map(({ id }) => ({
				id,
				enabled: enabled.has(id),
			})),
			...(active.skills?.length ? { skills: active.skills } : {}),
		};
	} catch {
		return null;
	}
}

async function persistMigration(projectPath: string, config: ProjectConfig) {
	await writeConfig(projectPath, config);
	await rm(legacyFile(projectPath), { force: true });
}

async function writeConfig(projectPath: string, config: ProjectConfig) {
	const file = configFile(projectPath);
	await mkdir(dirname(file), { recursive: true });
	const temporary = `${file}.tmp`;
	await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
	await rename(temporary, file);
}

function configFile(projectPath: string) {
	return join(projectPath, '.gizmo', 'config.json');
}

function legacyFile(projectPath: string) {
	return join(projectPath, '.gizmo', 'profiles.json');
}

function missing(error: unknown) {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT',
	);
}

interface LegacyProfile {
	id?: string;
	extensions?: WorkspaceIntegration[];
	skills?: ProjectSkill[];
}
