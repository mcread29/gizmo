import { resolve } from 'node:path';
import type { ResourceCatalog, SkillResource } from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { ProjectCatalog } from '../projects/project-catalog';
import { GlobalResourceStore } from './global-resource-settings';
import { listGizmoCompatiblePiExtensions } from './pi-global-resources';
import {
	discoverResources,
	type DiscoveredSkill,
	type Discover,
} from './resource-discovery';

/**
 * Discovery plus settings: what is on disk, what the user installed, and what
 * is enabled per workspace. Mutation goes through the global or project
 * stores; the on-disk layout is owned by `resource-discovery.ts`.
 */
export class ResourceCatalogService {
	readonly #projects: ProjectCatalog;
	readonly #global: GlobalResourceStore;
	readonly #discover: Discover;

	constructor(
		projects: ProjectCatalog = new ProjectCatalog(),
		global: GlobalResourceStore = new GlobalResourceStore(),
		discover: Discover = discoverResources,
	) {
		this.#projects = projects;
		this.#global = global;
		this.#discover = discover;
	}

	async list(workspacePath?: string): Promise<ResourceCatalog> {
		const path = workspacePath ? resolve(workspacePath) : undefined;
		const discovery = await this.#discover(path);
		const settings = await this.#register(discovery.skills);
		const overrides = new Map(
			(await this.#projects.skillsFor(path)).map(({ id, enabled }) => [
				id,
				enabled,
			]),
		);
		const installed = new Set(settings.installedSkills);
		const enabledGlobally = new Set(settings.enabledSkills);
		const globallyDisabled = new Set(settings.disabledGizmoExtensions);
		return {
			...(path ? { workspacePath: path } : {}),
			extensions: await listGizmoCompatiblePiExtensions(),
			gizmoExtensions: registeredExtensions().map(({ id, name }) => ({
				id,
				name,
				enabled: !globallyDisabled.has(id),
			})),
			skills: discovery.skills.map((skill) => {
				const override = overrides.get(skill.id);
				const globallyOn = enabledGlobally.has(skill.id);
				return {
					...skill,
					installed: installed.has(skill.id),
					enabledGlobally: globallyOn,
					enabled:
						installed.has(skill.id) &&
						(path && override !== undefined ? override : globallyOn),
					...(path && override !== undefined ? { override } : {}),
				} satisfies SkillResource;
			}),
			agentsFiles: discovery.agentsFiles,
			prompts: discovery.prompts,
			diagnostics: discovery.diagnostics,
		};
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	): Promise<ResourceCatalog> {
		const settings = await this.#global.read();
		const installed = new Set(settings.installedSkills);
		const enabled = new Set(settings.enabledSkills);
		const uninstalled = new Set(settings.uninstalledSkills);
		if (change.installed !== undefined) {
			if (change.installed) {
				installed.add(skillId);
				uninstalled.delete(skillId);
			} else {
				installed.delete(skillId);
				// Remembered so rediscovery does not reinstall it on the next list.
				uninstalled.add(skillId);
				// An uninstalled skill cannot stay enabled anywhere.
				enabled.delete(skillId);
			}
		}
		if (change.enabled !== undefined) {
			if (change.enabled) {
				installed.add(skillId);
				uninstalled.delete(skillId);
				enabled.add(skillId);
			} else enabled.delete(skillId);
		}
		await this.#global.write({
			...settings,
			installedSkills: [...installed],
			enabledSkills: [...enabled],
			uninstalledSkills: [...uninstalled],
		});
		return this.list(workspacePath);
	}

	/** Installed means on globally; this records the exceptions. */
	async setGlobalGizmoExtension(
		extensionId: string,
		enabled: boolean,
	): Promise<ResourceCatalog> {
		const settings = await this.#global.read();
		const disabled = new Set(settings.disabledGizmoExtensions);
		if (enabled) disabled.delete(extensionId);
		else disabled.add(extensionId);
		await this.#global.write({
			...settings,
			disabledGizmoExtensions: [...disabled],
		});
		return this.list();
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	): Promise<ResourceCatalog> {
		await this.#projects.setSkill(workspacePath, skillId, enabled);
		return this.list(workspacePath);
	}

	/**
	 * Paths of the skills a session in this workspace should load. Sessions
	 * receive these explicitly instead of letting Pi rediscover skills, so the
	 * catalog is the single source of truth for what is active.
	 */
	async enabledSkillPaths(workspacePath: string): Promise<string[]> {
		const catalog = await this.list(workspacePath);
		return catalog.skills
			.filter((skill) => skill.enabled)
			.map(({ path }) => path);
	}

	/** New skills are recorded as installed but stay disabled until asked for. */
	async #register(skills: DiscoveredSkill[]) {
		const settings = await this.#global.read();
		const installed = new Set(settings.installedSkills);
		const uninstalled = new Set(settings.uninstalledSkills);
		const before = installed.size;
		for (const skill of skills) {
			if (!uninstalled.has(skill.id)) installed.add(skill.id);
		}
		if (installed.size === before) return settings;
		const updated = {
			...settings,
			installedSkills: [...installed],
		};
		await this.#global.write(updated);
		return updated;
	}
}

// Re-exports so existing importers (tests, tooling) keep one entry point.
export { discoverResources, type Discovery } from './resource-discovery';
