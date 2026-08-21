import {
	mkdir,
	readFile,
	readdir,
	rename,
	stat,
	writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
	type ProjectDomains,
	type ProjectSkill,
	type StoredProject,
	type WorkspaceIntegration,
	type WorkspaceProfile,
	type WorkspaceProfiles,
} from '@gizmo/protocol';
import { defaultProfile, detectExtensions } from '../extensions/registry';
import { defaultDataDir } from '../sessions/session-repository';

export class ProjectCatalog {
	readonly #file: string;

	constructor(dataDir = defaultDataDir()) {
		this.#file = join(dataDir, 'projects.json');
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
				...(project.skills?.length ? { skills: project.skills } : {}),
				integrations:
					project.integrations ??
					(project.domainId && project.domainId !== 'generic'
						? [{ id: project.domainId, root: '.' }]
						: []),
			}));
		} catch (error) {
			if (missing(error)) return [];
			throw error;
		}
	}

	async detect(projectPath: string): Promise<ProjectDomains> {
		const path = await requireDirectory(projectPath);
		return detectExtensions(path);
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
	 * Flat, fuzzy-matched folder search rooted at `root`, for a command-palette
	 * style picker. An empty query only lists `root`'s immediate subfolders,
	 * since walking the whole tree with nothing to filter on is just noise.
	 */
	async search(query: string, root?: string) {
		const path = await requireDirectory(root ?? homedir());
		const needle = query.trim().toLowerCase();
		const matches: Array<{ name: string; path: string; score: number }> = [];

		const walk = async (dir: string, depth: number): Promise<void> => {
			if (matches.length >= searchResultLimit) return;
			let entries;
			try {
				entries = await readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (matches.length >= searchResultLimit) return;
				if (!entry.isDirectory()) continue;
				if (entry.name.startsWith('.') || skippedDirectoryNames.has(entry.name))
					continue;
				const entryPath = join(dir, entry.name);
				const score = matchScore(entry.name.toLowerCase(), needle);
				if (score >= 0) matches.push({ name: entry.name, path: entryPath, score });
				if (needle && depth < searchMaxDepth) await walk(entryPath, depth + 1);
			}
		};

		if (needle) await walk(path, 0);
		else {
			const entries = await readdir(path, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith('.')) {
					matches.push({ name: entry.name, path: join(path, entry.name), score: 0 });
				}
			}
		}

		matches.sort(
			(left, right) => right.score - left.score || left.name.localeCompare(right.name),
		);
		return {
			path,
			directories: matches
				.slice(0, searchResultLimit)
				.map(({ name, path: entryPath }) => ({ name, path: entryPath })),
		};
	}

	async add(
		projectPath: string,
		integrations: WorkspaceIntegration[],
	): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		await this.#validateIntegrations(path, integrations);
		const projects = await this.#readCatalog();
		const existing = projects.find((item) => item.path === path);
		const detected = await this.detect(path);
		const existingProfiles = await this.#profiles(path, existing);
		const profiles = profilesFromSelection(
			detected.profiles ?? [],
			integrations,
			activeProfile(existingProfiles)?.skills ?? [],
		);
		await this.#validateProfiles(path, profiles);
		await writeProfiles(path, profiles);
		const project: CatalogProject = {
			title: basename(path),
			path,
			addedAt: existing?.addedAt ?? Date.now(),
		};
		await this.#write([
			project,
			...projects.filter((item) => item.path !== path),
		]);
		return this.#storedProject(project);
	}

	async saveProfiles(
		projectPath: string,
		profiles: WorkspaceProfiles,
	): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		const projects = await this.#readCatalog();
		const existing = projects.find((item) => item.path === path);
		if (!existing) {
			throw new Error(`Workspace is not registered with Gizmo: ${path}`);
		}
		await this.#validateProfiles(path, profiles);
		await writeProfiles(path, profiles);
		return this.#storedProject(existing);
	}

	async remove(projectPath: string): Promise<void> {
		const path = resolve(projectPath);
		await this.#write(
			(await this.#readCatalog()).filter((project) => project.path !== path),
		);
	}

	/** Per-profile overrides of the global skill enablement. */
	async skillsFor(projectPath: string | undefined): Promise<ProjectSkill[]> {
		if (!projectPath) return [];
		const profiles = await this.profilesFor(projectPath);
		return activeProfile(profiles)?.skills ?? [];
	}

	/** Passing null clears the override so the global setting applies again. */
	async setSkill(
		projectPath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ProjectSkill[]> {
		const path = resolve(projectPath);
		const projects = await this.#readCatalog();
		const project = projects.find((item) => item.path === path);
		if (!project) {
			throw new Error(`Workspace is not registered with Gizmo: ${path}`);
		}
		const profiles = await this.#profiles(path, project);
		const profile = activeProfile(profiles);
		if (!profile) throw new Error('The active profile is missing');
		const skills = (profile.skills ?? []).filter(({ id }) => id !== skillId);
		if (enabled !== null) skills.push({ id: skillId, enabled });
		profile.skills = skills;
		await writeProfiles(path, profiles);
		return skills;
	}

	async profilesFor(
		projectPath: string | undefined,
	): Promise<WorkspaceProfiles> {
		if (!projectPath) return profilesFromSelection([], []);
		const path = resolve(projectPath);
		const project = (await this.#readCatalog()).find(
			(item) => item.path === path,
		);
		return this.#profiles(path, project);
	}

	async integrationsFor(
		projectPath: string | undefined,
	): Promise<WorkspaceIntegration[]> {
		if (!projectPath) return [];
		const profiles = await this.profilesFor(projectPath);
		return activeProfile(profiles)?.extensions ?? [];
	}

	async #storedProject(project: CatalogProject): Promise<StoredProject> {
		const profiles = await this.#profiles(project.path, project);
		const active = activeProfile(profiles);
		return {
			title: project.title,
			path: project.path,
			integrations: active?.extensions ?? [],
			activeProfileId: profiles.activeProfileId,
			profiles: profiles.profiles,
			...(active?.skills?.length ? { skills: active.skills } : {}),
			addedAt: project.addedAt,
		};
	}

	async #profiles(
		projectPath: string,
		project?: CatalogProject,
	): Promise<WorkspaceProfiles> {
		try {
			return normalizeProfiles(
				JSON.parse(await readFile(profileFile(projectPath), 'utf8')),
			);
		} catch (error) {
			if (!missing(error)) throw error;
			return profilesFromSelection(
				[],
				project?.integrations ?? [],
				project?.skills ?? [],
			);
		}
	}

	async #validateProfiles(
		projectPath: string,
		profiles: WorkspaceProfiles,
	): Promise<void> {
		if (!profiles.profiles.some(({ id }) => id === profiles.activeProfileId)) {
			throw new Error(`Unknown active profile: ${profiles.activeProfileId}`);
		}
		for (const profile of profiles.profiles) {
			await this.#validateIntegrations(projectPath, profile.extensions);
		}
	}

	async #validateIntegrations(
		projectPath: string,
		integrations: WorkspaceIntegration[],
	): Promise<void> {
		const known = new Set(
			(await this.detect(projectPath)).domains.map(({ id }) => id),
		);
		for (const integration of integrations) {
			if (!known.has(integration.id))
				throw new Error(`Unknown extension: ${integration.id}`);
			const root = resolve(projectPath, integration.root);
			if (root !== projectPath && !root.startsWith(`${projectPath}/`))
				throw new Error('Extension root must be inside the workspace');
			if (!(await stat(root)).isDirectory())
				throw new Error(
					`Extension root is not a directory: ${integration.root}`,
				);
		}
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
}

interface CatalogProject {
	title: string;
	path: string;
	addedAt: number;
	integrations?: WorkspaceIntegration[];
	skills?: ProjectSkill[];
}

interface LegacyProject {
	title: string;
	path: string;
	addedAt: number;
	domainId?: string;
	integrations?: WorkspaceIntegration[];
	skills?: ProjectSkill[];
}

function profileFile(projectPath: string): string {
	return join(projectPath, '.gizmo', 'profiles.json');
}

async function writeProfiles(
	projectPath: string,
	profiles: WorkspaceProfiles,
): Promise<void> {
	const file = profileFile(projectPath);
	await mkdir(dirname(file), { recursive: true });
	const temporary = `${file}.tmp`;
	await writeFile(temporary, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
	await rename(temporary, file);
}

function profilesFromSelection(
	templates: readonly WorkspaceProfile[],
	integrations: readonly WorkspaceIntegration[],
	skills: readonly ProjectSkill[] = [],
): WorkspaceProfiles {
	const defaultEntry = cloneProfile(
		templates.find(({ id }) => id === 'default') ?? defaultProfile(),
	);
	const selected = integrations.length
		? profileForSelection(templates, integrations, skills)
		: { ...defaultEntry, ...(skills.length ? { skills: [...skills] } : {}) };
	const profiles = uniqueProfiles([
		defaultEntry,
		...templates.filter(({ id }) => id !== 'default').map(cloneProfile),
		selected,
	]);
	return {
		version: 1,
		activeProfileId: selected.id,
		profiles,
	};
}

function profileForSelection(
	templates: readonly WorkspaceProfile[],
	integrations: readonly WorkspaceIntegration[],
	skills: readonly ProjectSkill[],
): WorkspaceProfile {
	if (integrations.length === 1) {
		const integration = integrations[0]!;
		const template = templates.find(({ id }) => id === integration.id);
		if (template) {
			return {
				...cloneProfile(template),
				extensions: [{ ...integration }],
				...(skills.length ? { skills: [...skills] } : {}),
			};
		}
	}
	const id = integrations.map(({ id }) => id).join('-') || 'default';
	return {
		id,
		name: title(id),
		source: 'workspace:legacy',
		base: 'default',
		extensions: integrations.map((integration) => ({ ...integration })),
		...(skills.length ? { skills: [...skills] } : {}),
		tools: { mode: 'default-plus-extension' },
		prompt: { mode: 'default-plus-extension-fragments' },
	};
}

function normalizeProfiles(input: unknown): WorkspaceProfiles {
	const candidate = input as Partial<WorkspaceProfiles>;
	const profiles = Array.isArray(candidate.profiles)
		? candidate.profiles.map(cloneProfile)
		: [defaultProfile()];
	if (!profiles.some(({ id }) => id === 'default')) {
		profiles.unshift(defaultProfile());
	}
	const activeProfileId =
		typeof candidate.activeProfileId === 'string' &&
		profiles.some(({ id }) => id === candidate.activeProfileId)
			? candidate.activeProfileId
			: profiles[0]!.id;
	return { version: 1, activeProfileId, profiles: uniqueProfiles(profiles) };
}

function activeProfile(
	profiles: WorkspaceProfiles,
): WorkspaceProfile | undefined {
	return profiles.profiles.find(({ id }) => id === profiles.activeProfileId);
}

function uniqueProfiles(profiles: WorkspaceProfile[]): WorkspaceProfile[] {
	const byId = new Map<string, WorkspaceProfile>();
	for (const profile of profiles) byId.set(profile.id, profile);
	return [...byId.values()];
}

function cloneProfile(profile: WorkspaceProfile): WorkspaceProfile {
	return {
		...profile,
		extensions: profile.extensions.map((extension) => ({ ...extension })),
		...(profile.skills
			? { skills: profile.skills.map((skill) => ({ ...skill })) }
			: {}),
	};
}

function title(id: string): string {
	return id
		.split('-')
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(' + ');
}

async function requireDirectory(input: string): Promise<string> {
	if (!isAbsolute(input)) throw new Error('Project path must be absolute');
	const path = resolve(input);
	if (!(await stat(path)).isDirectory()) {
		throw new Error('Project path is not a directory');
	}
	return path;
}

const searchResultLimit = 200;
const searchMaxDepth = 6;
const skippedDirectoryNames = new Set([
	'node_modules',
	'dist',
	'build',
	'target',
	'vendor',
	'venv',
	'obj',
	'bin',
	'Library',
	'Temp',
]);

/** -1 if `needle` doesn't match `name` at all; otherwise higher is a better match. */
function matchScore(name: string, needle: string): number {
	if (!needle) return 0;
	if (name === needle) return 4;
	if (name.startsWith(needle)) return 3;
	if (name.includes(needle)) return 2;
	return isSubsequence(name, needle) ? 1 : -1;
}

function isSubsequence(name: string, needle: string): boolean {
	let index = 0;
	for (const char of needle) {
		index = name.indexOf(char, index);
		if (index === -1) return false;
		index += 1;
	}
	return true;
}

function missing(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT',
	);
}
