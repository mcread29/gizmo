import { basename, resolve } from 'node:path';
import {
	type CompactionPolicy,
	defaultCompactionPolicy,
	type ProjectConfig,
	type ProjectDomains,
	type ProjectSkill,
	type StoredProject,
	type WorkspaceIntegration,
} from '@gizmo/protocol';
import { extensionsForWorkspace } from '../extensions/registry';
import { GlobalResourceStore } from '../resources/global-resource-settings';
import { defaultDataDir } from '../sessions/session-repository';
import { AsyncMutex } from './async-mutex';
import {
	browseProjects,
	requireDirectory,
	searchProjects,
} from './project-browser';
import {
	type CatalogProject,
	ProjectCatalogStore,
} from './project-catalog-store';
import { withHidden, reordered } from './project-catalog-rows';
import { ProjectConfigStore, withOverride } from './project-config-store';
import { ProjectIntegrationResolver } from './project-integration-resolver';
import { listPiExtensions } from '../resources/pi-global-resources';

/**
 * Project-scoped configuration, stored as `.gizmo/config.json` inside the
 * workspace. Only overrides live here; anything absent inherits the global
 * setting. A legacy `.gizmo/profiles.json` is migrated once and removed.
 */
export class ProjectCatalog {
	readonly #catalog: ProjectCatalogStore;
	readonly #configs = new ProjectConfigStore();
	readonly #integrations: ProjectIntegrationResolver;
	readonly #catalogMutex = new AsyncMutex();

	constructor(
		dataDir = defaultDataDir(),
		global: GlobalResourceStore = new GlobalResourceStore(dataDir),
	) {
		this.#catalog = new ProjectCatalogStore(dataDir);
		this.#integrations = new ProjectIntegrationResolver(this.#configs, global);
	}

	async list(): Promise<StoredProject[]> {
		return Promise.all(
			(await this.#catalog.read()).map((project) =>
				this.#storedProject(project),
			),
		);
	}

	async detect(projectPath: string): Promise<ProjectDomains> {
		await requireDirectory(projectPath);
		return {
			domains: extensionsForWorkspace(projectPath).map(({ id, name }) => ({
				id,
				name,
				root: '.',
			})),
			config: await this.configFor(projectPath),
		};
	}

	async browse(input?: string) {
		return browseProjects(input);
	}

	async search(query: string, root?: string) {
		return searchProjects(query, root);
	}

	async add(projectPath: string): Promise<StoredProject> {
		const path = await requireDirectory(projectPath);
		return this.#catalogMutex.run(async () => {
			const projects = await this.#catalog.read();
			// Reading config migrates legacy profiles before registration.
			await this.configFor(path);
			const existing = projects.find((item) => item.path === path);
			const project: CatalogProject = {
				title: basename(path),
				path,
				...(existing?.hidden ? { hidden: true } : {}),
				addedAt: existing?.addedAt ?? Date.now(),
			};
			await this.#catalog.write([
				project,
				...projects.filter((item) => item.path !== path),
			]);
			return this.#storedProject(project);
		});
	}

	async remove(projectPath: string): Promise<void> {
		const path = resolve(projectPath);
		await this.#catalogMutex.run(async () => {
			await this.#catalog.write(
				(await this.#catalog.read()).filter((project) => project.path !== path),
			);
		});
	}

	async setHidden(path: string, hidden: boolean): Promise<StoredProject> {
		return this.#catalogMutex.run(async () => {
			const next = withHidden(await this.#catalog.read(), path, hidden);
			await this.#catalog.write(next.projects);
			return this.#storedProject(next.project);
		});
	}

	async reorder(paths: string[]): Promise<StoredProject[]> {
		return this.#catalogMutex.run(async () => {
			const next = reordered(await this.#catalog.read(), paths);
			await this.#catalog.write(next);
			return Promise.all(next.map((project) => this.#storedProject(project)));
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
		const config = await this.#updateConfig(projectPath, (current) => ({
			...current,
			skills: withOverride(current.skills ?? [], skillId, enabled),
		}));
		return config.skills ?? [];
	}

	/** Removes an override so the global setting applies again. */
	async setGizmoExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		if ((await listPiExtensions()).some(({ id }) => id === extensionId)) {
			return this.setPiExtension(projectPath, extensionId, enabled);
		}
		return this.#updateConfig(projectPath, (config) => ({
			...config,
			gizmoExtensions: withOverride(
				config.gizmoExtensions ?? [],
				extensionId,
				enabled,
			),
		}));
	}

	/** Removes an override so the global setting applies again. */
	async setPiExtension(
		projectPath: string,
		extensionId: string,
		enabled: boolean | null,
	): Promise<ProjectConfig> {
		return this.#updateConfig(projectPath, (config) => ({
			...config,
			gizmoExtensions: (config.gizmoExtensions ?? []).filter(
				({ id }) => id !== extensionId,
			),
			piExtensions: withOverride(
				config.piExtensions ?? [],
				extensionId,
				enabled,
			),
		}));
	}

	/**
	 * Replaces the project's explicit Pi extension paths. An empty list
	 * clears them; listing a path opts the workspace into loading it.
	 */
	async setProjectExtensionPaths(
		projectPath: string,
		paths: readonly string[],
	): Promise<ProjectConfig> {
		return this.#updateConfig(projectPath, (config) => {
			const next = { ...config };
			if (paths.length) next.piExtensionPaths = [...new Set(paths)].sort();
			else delete next.piExtensionPaths;
			return next;
		});
	}

	/** The workspace's policy, or the default when it has none of its own. */
	async compactionFor(
		projectPath: string | undefined,
	): Promise<CompactionPolicy> {
		if (!projectPath) return defaultCompactionPolicy;
		return (
			(await this.configFor(projectPath)).compaction ?? defaultCompactionPolicy
		);
	}

	async setCompaction(
		projectPath: string,
		compaction: CompactionPolicy,
	): Promise<CompactionPolicy> {
		const config = await this.#updateConfig(projectPath, (current) => ({
			...current,
			compaction,
		}));
		return config.compaction ?? defaultCompactionPolicy;
	}

	/** Explicit Pi extension paths of one workspace. */
	async projectExtensionPathsFor(projectPath: string): Promise<string[]> {
		return (await this.configFor(projectPath)).piExtensionPaths ?? [];
	}

	/**
	 * Every registered project's explicit extension paths, for the catalog
	 * scan. Only registered projects can carry paths, so nothing is ever
	 * discovered from a workspace directory itself.
	 */
	async projectExtensionPaths(): Promise<
		{ workspaceRoot: string; paths: string[] }[]
	> {
		const entries: { workspaceRoot: string; paths: string[] }[] = [];
		for (const { path } of await this.#catalog.read()) {
			const paths = (await this.configFor(path)).piExtensionPaths ?? [];
			if (paths.length) entries.push({ workspaceRoot: path, paths });
		}
		return entries;
	}

	/** Gizmo extensions effectively enabled for new sessions. */
	async integrationsFor(
		projectPath: string | undefined,
	): Promise<WorkspaceIntegration[]> {
		if (!projectPath) return [];
		return (await this.#integrations.resolve(projectPath)).integrations;
	}

	/** Pi extension ids this workspace switches, against the global state. */
	async piExtensionOverridesFor(
		path: string,
	): Promise<{ disabled: string[]; enabled: string[] }> {
		const config = await this.configFor(path);
		const rows = [
			...new Map(
				[...(config.gizmoExtensions ?? []), ...(config.piExtensions ?? [])].map(
					(row) => [row.id, row],
				),
			).values(),
		];
		return {
			disabled: rows.filter((row) => !row.enabled).map(({ id }) => id),
			enabled: rows.filter((row) => row.enabled).map(({ id }) => id),
		};
	}

	async configFor(projectPath: string): Promise<ProjectConfig> {
		return this.#configs.read(projectPath);
	}

	async #updateConfig(
		projectPath: string,
		update: (config: ProjectConfig) => ProjectConfig,
	) {
		const path = await requireDirectory(projectPath);
		const projects = await this.#catalog.read();
		if (!projects.some((item) => item.path === path)) {
			throw new Error(`Workspace is not registered with Gizmo: ${path}`);
		}
		return this.#configs.update(path, update);
	}

	async #storedProject(project: CatalogProject): Promise<StoredProject> {
		const { config, integrations } = await this.#integrations.resolve(
			project.path,
		);
		return {
			title: project.title,
			path: project.path,
			integrations,
			...(config.skills?.length ? { skills: config.skills } : {}),
			...(project.hidden ? { hidden: true } : {}),
			addedAt: project.addedAt,
		};
	}
}
