import { readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type { AgentResource, ResourceScope } from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import {
	extensionResourceRoots,
	linkedExtensionResourceRoots,
} from './extension-resources';
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

export type Discover = (
	workspacePath?: string,
	projectExtensionPaths?: readonly string[],
) => Promise<Discovery>;

/**
 * Walks every resource root — managed global directories, the workspace, and
 * installed extensions — and returns what Pi would load. Nothing here applies
 * enablement; the catalog turns discovery plus settings into a `ResourceCatalog`.
 */
export async function discoverResources(
	workspacePath?: string,
	projectExtensionPaths: readonly string[] = [],
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
	const [skillDirs, promptDirs, agentsFiles, fromExtensions, piExtensions] =
		await Promise.all([
			existingDirectories(roots.skills),
			existingDirectories(roots.prompts),
			existingFiles(roots.agentsFiles),
			extensionResourceRoots(registeredExtensions()),
			listPiExtensions(),
		]);
	const fromLinkedExtensions = await linkedExtensionResourceRoots(
		piExtensions
			.filter((extension) => extension.enabled)
			.map((extension) => extension.path),
	);
	const fromProjectExtensions = await linkedExtensionResourceRoots(
		projectExtensionPaths,
	);
	const allSkillDirs = [
		...skillDirs,
		...fromExtensions.skills,
		...fromLinkedExtensions.skills,
		...fromProjectExtensions.skills,
	];
	const canonicalSkillDirs = await Promise.all(
		allSkillDirs.map(async (source) => ({
			source,
			canonical: await realpath(source).catch(() => resolve(source)),
		})),
	);

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
		additionalSkillPaths: allSkillDirs,
		additionalPromptTemplatePaths: [
			...promptDirs,
			...fromExtensions.prompts,
			...fromLinkedExtensions.prompts,
			...fromProjectExtensions.prompts,
		],
	});
	await loader.reload();

	const skills = loader.getSkills();
	const prompts = loader.getPrompts();
	return {
		skills: await Promise.all(
			skills.skills.map(async (skill) => {
				const scope = pathScope(skill.filePath, workspacePath);
				const canonicalPath = await realpath(skill.filePath).catch(() =>
					resolve(skill.filePath),
				);
				return {
					id: `${scope}/${skill.name}`,
					name: skill.name,
					description: skill.description,
					scope,
					path: skill.filePath,
					source:
						sourceRoot(canonicalPath, canonicalSkillDirs) ?? skill.baseDir,
					editable: roots.skills.some((root) => isInside(skill.filePath, root)),
				};
			}),
		),
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

function sourceRoot(
	path: string,
	roots: { source: string; canonical: string }[],
) {
	return roots
		.filter((root) => isInside(path, root.canonical))
		.sort(
			(a, b) => resolve(b.canonical).length - resolve(a.canonical).length,
		)[0]?.source;
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
