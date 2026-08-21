import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';

/**
 * Gizmo owns the resources it loads. Pi's agent directory still holds runtime
 * concerns such as credentials and model configuration, but nothing Gizmo puts
 * in front of the model is read from there.
 */
export interface ResourceRoots {
	/** Directories holding skills, in precedence order. */
	skills: string[];
	/** Directories holding prompt templates. */
	prompts: string[];
	/** Candidate AGENTS.md files. */
	agentsFiles: string[];
}

export function globalResourceRoots(dataDir = defaultDataDir()): ResourceRoots {
	return {
		skills: [join(dataDir, 'skills')],
		prompts: [join(dataDir, 'prompts')],
		agentsFiles: [join(dataDir, 'AGENTS.md')],
	};
}

export function workspaceResourceRoots(workspacePath: string): ResourceRoots {
	return {
		skills: [
			join(workspacePath, '.gizmo', 'skills'),
			join(workspacePath, '.agents', 'skills'),
		],
		prompts: [
			join(workspacePath, '.gizmo', 'prompts'),
			join(workspacePath, '.agents', 'prompts'),
		],
		agentsFiles: [
			join(workspacePath, 'AGENTS.md'),
			join(workspacePath, '.gizmo', 'AGENTS.md'),
		],
	};
}

export function resourceRoots(
	workspacePath?: string,
	dataDir = defaultDataDir(),
): ResourceRoots {
	const global = globalResourceRoots(dataDir);
	if (!workspacePath) return global;
	const workspace = workspaceResourceRoots(workspacePath);
	return {
		skills: [...global.skills, ...workspace.skills],
		prompts: [...global.prompts, ...workspace.prompts],
		agentsFiles: [...global.agentsFiles, ...workspace.agentsFiles],
	};
}

/**
 * Copies skills and AGENTS.md out of Pi's agent directory the first time, so
 * moving to Gizmo-owned folders does not silently drop what was already set up.
 * Runs once: a Gizmo skills directory that already exists is left alone, and
 * the originals are never modified.
 */
export async function adoptPiResources(
	dataDir = defaultDataDir(),
	piAgentDir = join(homedir(), '.pi', 'agent'),
): Promise<boolean> {
	const target = join(dataDir, 'skills');
	if (await exists(target)) return false;
	const source = join(piAgentDir, 'skills');
	if (!(await exists(source))) return false;

	await mkdir(dataDir, { recursive: true });
	await cp(source, target, { recursive: true });
	const agentsFile = join(piAgentDir, 'AGENTS.md');
	if (
		(await exists(agentsFile)) &&
		!(await exists(join(dataDir, 'AGENTS.md')))
	) {
		await cp(agentsFile, join(dataDir, 'AGENTS.md'));
	}
	return true;
}

/** Directory entries that exist, so callers can skip absent roots quietly. */
export async function existingDirectories(paths: string[]): Promise<string[]> {
	const found: string[] = [];
	for (const path of paths) {
		try {
			if ((await readdir(path)).length >= 0) found.push(path);
		} catch {
			// A root that has not been created yet simply contributes nothing.
		}
	}
	return found;
}

export async function existingFiles(paths: string[]): Promise<string[]> {
	const found: string[] = [];
	for (const path of paths) {
		try {
			if ((await stat(path)).isFile()) found.push(path);
		} catch {
			// Absent context files are normal.
		}
	}
	return found;
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
