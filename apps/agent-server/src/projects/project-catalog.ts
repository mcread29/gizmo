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
} from '@unity-agent/protocol';
import { detectDomains } from '../domains/registry';
import { defaultDataDir } from '../sessions/session-repository';

export class ProjectCatalog {
	readonly #file: string;

	constructor(dataDir = defaultDataDir()) {
		this.#file = join(dataDir, 'projects.json');
	}

	async list(): Promise<StoredProject[]> {
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
		return { domains: await detectDomains(path) };
	}

	async browse(input?: string) {
		const path = await requireDirectory(input ?? homedir());
		const entries = await readdir(path, { withFileTypes: true });
		const parent = dirname(path);
		return {
			path,
			...(parent !== path ? { parent } : {}),
			directories: entries
				.filter((entry) => entry.isDirectory())
				.sort((left, right) => left.name.localeCompare(right.name))
				.map((entry) => ({ name: entry.name, path: join(path, entry.name) })),
		};
	}

	async add(
		projectPath: string,
		integrations: WorkspaceIntegration[],
	): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		const known = new Set(
			(await this.detect(path)).domains.map(({ id }) => id),
		);
		for (const integration of integrations) {
			if (!known.has(integration.id))
				throw new Error(`Unknown integration: ${integration.id}`);
			const root = resolve(path, integration.root);
			if (root !== path && !root.startsWith(`${path}/`))
				throw new Error('Integration root must be inside the workspace');
			if (!(await stat(root)).isDirectory())
				throw new Error(
					`Integration root is not a directory: ${integration.root}`,
				);
		}
		const projects = await this.list();
		const existing = projects.find((item) => item.path === path);
		const project = {
			title: basename(path),
			path,
			integrations,
			...(existing?.skills?.length ? { skills: existing.skills } : {}),
			addedAt: existing?.addedAt ?? Date.now(),
		};
		await this.#write([
			project,
			...projects.filter((item) => item.path !== path),
		]);
		return project;
	}

	async remove(projectPath: string): Promise<void> {
		const path = resolve(projectPath);
		await this.#write(
			(await this.list()).filter((project) => project.path !== path),
		);
	}

	/** Per-workspace overrides of the global skill enablement. */
	async skillsFor(projectPath: string | undefined): Promise<ProjectSkill[]> {
		if (!projectPath) return [];
		return (
			(await this.list()).find(({ path }) => path === resolve(projectPath))
				?.skills ?? []
		);
	}

	/** Passing null clears the override so the global setting applies again. */
	async setSkill(
		projectPath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ProjectSkill[]> {
		const path = resolve(projectPath);
		const projects = await this.list();
		const project = projects.find((item) => item.path === path);
		if (!project) {
			throw new Error(`Workspace is not registered with Gizmo: ${path}`);
		}
		const skills = (project.skills ?? []).filter(({ id }) => id !== skillId);
		if (enabled !== null) skills.push({ id: skillId, enabled });
		project.skills = skills;
		await this.#write(projects);
		return skills;
	}

	async integrationsFor(
		projectPath: string | undefined,
	): Promise<WorkspaceIntegration[]> {
		if (!projectPath) return [];
		return (
			(await this.list()).find(({ path }) => path === resolve(projectPath))
				?.integrations ?? []
		);
	}

	async #write(projects: StoredProject[]): Promise<void> {
		await mkdir(dirname(this.#file), { recursive: true });
		const temporary = `${this.#file}.tmp`;
		await writeFile(
			temporary,
			`${JSON.stringify(projects, null, 2)}\n`,
			'utf8',
		);
		await rename(temporary, this.#file);
	}
}

interface LegacyProject {
	title: string;
	path: string;
	addedAt: number;
	domainId?: string;
	integrations?: WorkspaceIntegration[];
	skills?: ProjectSkill[];
}

async function requireDirectory(input: string): Promise<string> {
	if (!isAbsolute(input)) throw new Error('Project path must be absolute');
	const path = resolve(input);
	if (!(await stat(path)).isDirectory()) {
		throw new Error('Project path is not a directory');
	}
	return path;
}

function missing(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT',
	);
}
