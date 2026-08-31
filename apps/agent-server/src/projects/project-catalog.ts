import { basename, resolve } from 'node:path';
import {
	type ProjectConfig,
	type ProjectDomains,
	type ProjectSkill,
	type StoredProject,
	type WorkspaceIntegration,
} from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
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
import { ProjectConfigStore, withOverride } from './project-config-store';
import { ProjectIntegrationResolver } from './project-integration-resolver';

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
			domains: registeredExtensions().map(({ id, name }) => ({
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
			const project: CatalogProject = {
				title: basename(path),
				path,
				addedAt:
					projects.find((item) => item.path === path)?.addedAt ?? Date.now(),
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
			piExtensions: withOverride(
				config.piExtensions ?? [],
				extensionId,
				enabled,
			),
		}));
	}

	/** Gizmo extensions effectively enabled for new sessions. */
	async integrationsFor(
		projectPath: string | undefined,
	): Promise<WorkspaceIntegration[]> {
		if (!projectPath) return [];
		return (await this.#integrations.resolve(projectPath)).integrations;
	}

	/** Pi extension ids this workspace turns off despite the global state. */
	async disabledPiExtensionsFor(path: string): Promise<string[]> {
		const config = await this.configFor(path);
		return (config.piExtensions ?? [])
			.filter((override) => !override.enabled)
			.map((override) => override.id);
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
			addedAt: project.addedAt,
		};
	}
}
