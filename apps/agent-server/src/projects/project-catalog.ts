import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
	type ExtensionOverride,
	type ProjectConfig,
	type ProjectDomains,
	type ProjectSkill,
	type StoredProject,
	type WorkspaceIntegration,
} from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { isPathWithin } from '../path-utils';
import { GlobalResourceStore } from '../resources/global-resource-settings';
import { listPiExtensions } from '../resources/pi-global-resources';
import { defaultDataDir } from '../sessions/session-repository';

/**
 * Project-scoped configuration, stored as `.gizmo/config.json` inside the
 * workspace. Only overrides live here; anything absent inherits the global
 * setting. A legacy `.gizmo/profiles.json` is migrated once and removed.
 */
export class ProjectCatalog {
	readonly #file: string;
	readonly #global: GlobalResourceStore;
	readonly #catalogMutex = new AsyncMutex();
	readonly #configMutexes = new Map<string, AsyncMutex>();

	constructor(
		dataDir = defaultDataDir(),
		global: GlobalResourceStore = new GlobalResourceStore(dataDir),
	) {
		this.#file = join(dataDir, 'projects.json');
		this.#global = global;
	}

	#configMutex(projectPath: string): AsyncMutex {
		const key = resolve(projectPath);
		let mutex = this.#configMutexes.get(key);
		if (!mutex) {
			mutex = new AsyncMutex();
			this.#configMutexes.set(key, mutex);
		}
		return mutex;
	}

	async list(): Promise<StoredProject[]> {
		return Promise.all(
			(await this.#readCatalog()).map((project) =>
				this.#storedProject(project),
			),
		);
	}

	async #readCatalog(): Promise<CatalogProject[]> {
		try {
			const input = JSON.parse(
				await readFile(this.#file, 'utf8'),
			) as LegacyProject[];
			return input.map((project) => ({
				title: project.title,
				path: project.path,
				addedAt: project.addedAt,
			}));
		} catch (error) {
			if (missing(error)) return [];
			throw error;
		}
	}

	async detect(projectPath: string): Promise<ProjectDomains> {
		await requireDirectory(projectPath);
		return {
			domains: registeredExtensions().map(({ id, name }) => ({
				id,
				name,
				root: '.',
			})),
			config: await this.configFor(projectPath),
		};
	}

	async browse(input?: string) {
		const path = await requireDirectory(input ?? homedir());
		const entries = await readdir(path, { withFileTypes: true });
		const parent = dirname(path);
		return {
			path,
			...(parent !== path ? { parent } : {}),
			directories: entries
				.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((entry) => ({ name: entry.name, path: join(path, entry.name) })),
		};
	}

	/**
	 * The folders directly inside `root`, filtered by `query` — never
	 * recursive. A folder picker should behave like a shell's tab completion:
	 * narrow what's in front of you, not fuzzy-match anything anywhere in the
	 * tree, which surfaces unrelated noise several levels deep.
	 */
	async search(query: string, root?: string) {
		const path = await requireDirectory(root ?? homedir());
		const needle = query.trim().toLowerCase();
		const entries = await readdir(path, { withFileTypes: true });
		const matches = entries.flatMap((entry) => {
			if (!entry.isDirectory() || entry.name.startsWith('.')) return [];
			const score = matchScore(entry.name.toLowerCase(), needle);
			if (score < 0) return [];
			return [{ name: entry.name, path: join(path, entry.name), score }];
		});

		matches.sort(
			(left, right) =>
				right.score - left.score || left.name.localeCompare(right.name),
		);
		return {
			path,
			directories: matches.map(({ name, path: entryPath }) => ({
				name,
				path: entryPath,
			})),
		};
	}

	async add(projectPath: string): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		return this.#catalogMutex.run(async () => {
			const projects = await this.#readCatalog();
			// Reading the configuration migrates a legacy profiles.json if one
			// exists, so a workspace re-added to Gizmo keeps its overrides.
			await this.configFor(path);
			const project: CatalogProject = {
				title: basename(path),
				path,
				addedAt:
					projects.find((item) => item.path === path)?.addedAt ?? Date.now(),
			};
			await this.#write([
				project,
				...projects.filter((item) => item.path !== path),
			]);
			return this.#storedProject(project);
		});
	}

	async remove(projectPath: string): Promise<void> {
		const path = resolve(projectPath);
		await this.#catalogMutex.run(async () => {
			await this.#write(
				(await this.#readCatalog()).filter((project) => project.path !== path),
			);
		});
	}

	/** Overrides of the global skill enablement for this workspace. */
	async skillsFor(projectPath: string | undefined): Promise<ProjectSkill[]> {
		if (!projectPath) return [];
		return (await this.configFor(projectPath)).skills ?? [];
	}

	/** Passing null clears the override so the global setting applies again. */
	async setSkill(
		projectPath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ProjectSkill[]> {
		return this.#updateConfig(projectPath, (config) => ({
			...config,
			skills: withOverrides(
				config.skills ?? [],
				skillId,
				enabled,
				(skill) => skill.id,
			),
		})).then(({ config }) => config.skills ?? []);
	}

	/** Removes an override so the global setting applies again. */
	async setGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		return this.#updateConfig(projectPath, (config) => ({
			...config,
			gizmoExtensions: withOverrides(
				config.gizmoExtensions ?? [],
				extensionId,
				enabled,
				(override) => override.id,
			),
		})).then(({ config }) => config);
	}

	/** Removes an override so the global setting applies again. */
	async setPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		return this.#updateConfig(projectPath, (config) => ({
			...config,
			piExtensions: withOverrides(
				config.piExtensions ?? [],
				extensionId,
				enabled,
				(override) => override.id,
			),
		})).then(({ config }) => config);
	}

	/**
	 * Gizmo extensions effectively enabled for new sessions: the global
	 * toggles, adjusted by this workspace's overrides.
	 */
	async integrationsFor(
		projectPath: string | undefined,
	): Promise<WorkspaceIntegration[]> {
		if (!projectPath) return [];
		const { integrations } = await this.#resolve(projectPath);
		return integrations;
	}

	/** Pi extension ids this workspace turns off despite the global state. */
	async disabledPiExtensionsFor(path: string): Promise<string[]> {
		const config = await this.configFor(path);
		return (config.piExtensions ?? [])
			.filter((override) => !override.enabled)
			.map((override) => override.id);
	}

	async #updateConfig(
		projectPath: string,
		update: (config: ProjectConfig) => ProjectConfig,
	): Promise<{ path: string; config: ProjectConfig }> {
		const path = await requireDirectory(projectPath);
		const projects = await this.#readCatalog();
		if (!projects.some((item) => item.path === path)) {
			throw new Error(`Workspace is not registered with Gizmo: ${path}`);
		}
		return this.#configMutex(path).run(async () => {
			const config = normalizeConfig(update(await this.configFor(path)));
			await this.#validateConfig(config);
			await writeConfig(path, config);
			return { path, config };
		});
	}

	async #resolve(projectPath: string): Promise<{
		config: ProjectConfig;
		integrations: WorkspaceIntegration[];
	}> {
		const config = await this.configFor(projectPath);
		const overrides = new Map(
			(config.gizmoExtensions ?? []).map(({ id, enabled }) => [id, enabled]),
		);
		const globallyDisabled = new Set(
			(await this.#global.read()).disabledGizmoExtensions,
		);
		const integrations = registeredExtensions()
			.filter(({ id }) => overrides.get(id) ?? !globallyDisabled.has(id))
			.map(({ id }) => ({ id, root: '.' }));
		return { config, integrations };
	}

	/**
	 * Gizmo extensions effectively enabled for a workspace, plus any skill
	 * overrides — the shape the UI and session catalog display.
	 */
	async #storedProject(project: CatalogProject): Promise<StoredProject> {
		const { config, integrations } = await this.#resolve(project.path);
		return {
			title: project.title,
			path: project.path,
			integrations,
			...(config.skills?.length ? { skills: config.skills } : {}),
			addedAt: project.addedAt,
		};
	}

	async configFor(projectPath: string): Promise<ProjectConfig> {
		const path = resolve(projectPath);
		try {
			return normalizeConfig(
				JSON.parse(await readFile(configFile(path), 'utf8')),
			);
		} catch (error) {
			if (!missing(error)) throw error;
		}
		// No config file: a legacy profiles.json is migrated once, otherwise
		// the project simply inherits every global setting.
		const migrated = await this.#migrateLegacyProfiles(path);
		return migrated ?? { version: 1 };
	}

	/**
	 * Derives overrides from a legacy `.gizmo/profiles.json` active profile and
	 * removes the file. Under the old system every workspace started with no
	 * extensions enabled, so the active profile's extension list becomes an
	 * explicit snapshot: installed extensions it listed stay on, the rest off.
	 */
	async #migrateLegacyProfiles(path: string): Promise<ProjectConfig | null> {
		const legacy = join(path, '.gizmo', 'profiles.json');
		let active: LegacyProfile;
		try {
			const stored = JSON.parse(await readFile(legacy, 'utf8')) as {
				activeProfileId?: string;
				profiles?: LegacyProfile[];
			};
			const profiles = stored.profiles ?? [];
			active =
				profiles.find(({ id }) => id === stored.activeProfileId) ??
				profiles[0] ??
				{};
		} catch {
			return null;
		}
		const enabled = new Set((active.extensions ?? []).map(({ id }) => id));
		const config: ProjectConfig = {
			version: 1,
			gizmoExtensions: registeredExtensions().map(({ id }) => ({
				id,
				enabled: enabled.has(id),
			})),
			...(active.skills?.length ? { skills: active.skills } : {}),
		};
		await this.#configMutex(path).run(async () => {
			await writeConfig(path, config);
			await rm(legacy, { force: true });
		});
		return config;
	}

	async #write(projects: CatalogProject[]): Promise<void> {
		await mkdir(dirname(this.#file), { recursive: true });
		const temporary = `${this.#file}.tmp`;
		await writeFile(
			temporary,
			`${JSON.stringify(
				projects.map(({ title, path, addedAt }) => ({ title, path, addedAt })),
				null,
				2,
			)}\n`,
			'utf8',
		);
		await rename(temporary, this.#file);
	}

	async #validateConfig(config: ProjectConfig): Promise<void> {
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
}

interface LegacyProfile {
	id?: string;
	extensions?: WorkspaceIntegration[];
	skills?: ProjectSkill[];
}

interface CatalogProject {
	title: string;
	path: string;
	addedAt: number;
}

interface LegacyProject {
	title: string;
	path: string;
	addedAt: number;
}

function configFile(projectPath: string): string {
	return join(projectPath, '.gizmo', 'config.json');
}

async function writeConfig(
	projectPath: string,
	config: ProjectConfig,
): Promise<void> {
	const file = configFile(projectPath);
	await mkdir(dirname(file), { recursive: true });
	const temporary = `${file}.tmp`;
	await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
	await rename(temporary, file);
}

/** Removes empty sections and duplicate rows so stored files stay minimal. */
function normalizeConfig(input: unknown): ProjectConfig {
	const candidate = input as Partial<ProjectConfig>;
	const overrides = (overrides?: ExtensionOverride[]) => {
		const byId = new Map<string, ExtensionOverride>();
		for (const override of overrides ?? []) {
			if (
				typeof override?.id === 'string' &&
				typeof override.enabled === 'boolean'
			) {
				byId.set(override.id, { id: override.id, enabled: override.enabled });
			}
		}
		return [...byId.values()].sort((left, right) =>
			left.id.localeCompare(right.id),
		);
	};
	const skills = (overrides(candidate.skills) ?? []).map(({ id, enabled }) => ({
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

function withOverrides<T>(
	rows: T[],
	id: string,
	enabled: boolean | null,
	key: (row: T) => string,
): T[] {
	const rest = rows.filter((row) => key(row) !== id);
	if (enabled === null) return rest;
	return [
		...rest,
		{ ...(rows.find((row) => key(row) === id) ?? {}), id, enabled } as T,
	].sort((left, right) => key(left).localeCompare(key(right)));
}

async function requireDirectory(input: string): Promise<string> {
	if (!isAbsolute(input)) throw new Error('Project path must be absolute');
	const path = resolve(input);
	if (!(await stat(path)).isDirectory()) {
		throw new Error('Project path is not a directory');
	}
	return path;
}

/**
 * -1 if `needle` doesn't match `name` at all; otherwise higher is a better
 * match. Requires an actual substring — a loose subsequence match (letters of
 * "repos" appear in order somewhere in "Crash Reports") surfaces nonsense.
 */
function matchScore(name: string, needle: string): number {
	if (!needle) return 0;
	if (name === needle) return 3;
	if (name.startsWith(needle)) return 2;
	return name.includes(needle) ? 1 : -1;
}

function missing(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT',
	);
}

class AsyncMutex {
	#tail: Promise<void> = Promise.resolve();

	async run<T>(fn: () => Promise<T>): Promise<T> {
		const previous = this.#tail;
		let release!: () => void;
		this.#tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			return await fn();
		} finally {
			release();
		}
	}
}
