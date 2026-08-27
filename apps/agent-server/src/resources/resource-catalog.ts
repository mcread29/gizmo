import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type {
	AgentResource,
	ResourceCatalog,
	ResourceScope,
	SkillResource,
} from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { ProjectCatalog } from '../projects/project-catalog';
import { extensionResourceRoots } from './extension-resources';
import { GlobalResourceStore } from './global-resource-settings';
import { listPiExtensions } from './pi-global-resources';
import {
	adoptPiResources,
	existingDirectories,
	existingFiles,
	resourceRoots,
} from './resource-paths';

/** One discovered on-disk resource, before enablement is applied. */
export interface DiscoveredSkill {
	id: string;
	name: string;
	description: string;
	scope: ResourceScope;
	path: string;
	source: string;
	editable?: boolean;
}

export interface Discovery {
	skills: DiscoveredSkill[];
	agentsFiles: AgentResource[];
	prompts: AgentResource[];
	diagnostics: string[];
}

export type Discover = (workspacePath?: string) => Promise<Discovery>;

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
			extensions: await listPiExtensions(),
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

export async function discoverResources(
	workspacePath?: string,
): Promise<Discovery> {
	const { DefaultResourceLoader, getAgentDir, SettingsManager } =
		await import('@earendil-works/pi-coding-agent');
	const agentDir = getAgentDir();
	const cwd = workspacePath ?? homedir();
	await adoptPiResources();
	const roots = resourceRoots(workspacePath);
	// Extensions ship skills through their own package, using Pi's convention;
	// installing the package is the opt-in, and each skill still stays disabled
	// until enabled through the catalog like any other.
	const [skillDirs, promptDirs, agentsFiles, fromExtensions] =
		await Promise.all([
			existingDirectories(roots.skills),
			existingDirectories(roots.prompts),
			existingFiles(roots.agentsFiles),
			extensionResourceRoots(registeredExtensions()),
		]);

	// Pi parses these, but only from the paths Gizmo hands it: none of its own
	// discovery locations contribute, so nothing under ~/.pi reaches a session.
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager: SettingsManager.create(cwd, agentDir),
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		additionalSkillPaths: [...skillDirs, ...fromExtensions.skills],
		additionalPromptTemplatePaths: [...promptDirs, ...fromExtensions.prompts],
	});
	await loader.reload();

	const skills = loader.getSkills();
	const prompts = loader.getPrompts();
	return {
		skills: skills.skills.map((skill) => {
			const scope = pathScope(skill.filePath, workspacePath);
			return {
				id: `${scope}/${skill.name}`,
				name: skill.name,
				description: skill.description,
				scope,
				path: skill.filePath,
				source: skill.baseDir,
				editable: roots.skills.some((root) => isInside(skill.filePath, root)),
			};
		}),
		agentsFiles: await Promise.all(
			agentsFiles.map(async (path) => ({
				id: `agents:${path}`,
				name: basename(path),
				description: firstLine(await readFile(path, 'utf8')),
				scope: pathScope(path, workspacePath),
				path,
			})),
		),
		prompts: prompts.prompts.map((prompt) => ({
			id: `prompt:${prompt.filePath}`,
			name: prompt.name,
			...(prompt.description ? { description: prompt.description } : {}),
			scope: pathScope(prompt.filePath, workspacePath),
			path: prompt.filePath,
		})),
		diagnostics: [
			...skills.diagnostics.map(({ message }) => message),
			...prompts.diagnostics.map(({ message }) => message),
		],
	};
}

/** Anything inside the open workspace is project scope; the rest is global. */
function pathScope(path: string, workspacePath?: string): ResourceScope {
	if (!workspacePath) return 'global';
	const fromWorkspace = relative(resolve(workspacePath), resolve(path));
	return fromWorkspace !== '' &&
		!isAbsolute(fromWorkspace) &&
		fromWorkspace !== '..' &&
		!fromWorkspace.startsWith(`..${sep}`)
		? 'project'
		: 'global';
}

function isInside(path: string, root: string) {
	const fromRoot = relative(resolve(root), resolve(path));
	return (
		fromRoot !== '' &&
		!isAbsolute(fromRoot) &&
		fromRoot !== '..' &&
		!fromRoot.startsWith(`..${sep}`)
	);
}

function firstLine(content: string): string {
	const line = content
		.split('\n')
		.map((value) => value.trim())
		.find((value) => value && !value.startsWith('#'));
	return line ? line.slice(0, 200) : '';
}
