import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import {
	parseStoredProjects,
	type ProjectDomains,
	type StoredProject,
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
			return parseStoredProjects(
				JSON.parse(await readFile(this.#file, 'utf8')) as unknown,
			);
		} catch (error) {
			if (missing(error)) return [];
			throw error;
		}
	}

	async detect(projectPath: string): Promise<ProjectDomains> {
		const path = await requireDirectory(projectPath);
		return {
			domains: [
				...(await detectDomains(path)),
				{ id: 'generic', name: 'Generic', detected: true },
			],
		};
	}

	async add(projectPath: string, domainId: string): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		const selected = (await this.detect(path)).domains.find(
			({ id }) => id === domainId,
		);
		if (!selected?.detected) {
			throw new Error(`Domain ${domainId} does not match this project`);
		}
		const projects = await this.list();
		const project = {
			title: basename(path),
			path,
			domainId,
			addedAt:
				projects.find((item) => item.path === path)?.addedAt ?? Date.now(),
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

	async domainFor(projectPath: string | undefined): Promise<string> {
		if (!projectPath) return 'generic';
		return (
			(await this.list()).find(({ path }) => path === resolve(projectPath))
				?.domainId ?? 'generic'
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
