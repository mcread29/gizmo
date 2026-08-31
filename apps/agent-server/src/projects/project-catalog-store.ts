import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface CatalogProject {
	title: string;
	path: string;
	addedAt: number;
}

export class ProjectCatalogStore {
	readonly #file: string;

	constructor(dataDir: string) {
		this.#file = join(dataDir, 'projects.json');
	}

	async read(): Promise<CatalogProject[]> {
		try {
			const input = JSON.parse(
				await readFile(this.#file, 'utf8'),
			) as CatalogProject[];
			return input.map(({ title, path, addedAt }) => ({
				title,
				path,
				addedAt,
			}));
		} catch (error) {
			if (missing(error)) return [];
			throw error;
		}
	}

	async write(projects: CatalogProject[]) {
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

function missing(error: unknown) {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		error.code === 'ENOENT',
	);
}
