import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Global resources stay canonical in Pi's directories; workspace resources
 * remain local to the selected project. */
export interface ResourceRoots {
	/** Directories holding skills, in precedence order. */
	skills: string[];
	/** Directories holding prompt templates. */
	prompts: string[];
	/** Candidate AGENTS.md files. */
	agentsFiles: string[];
}

export function globalResourceRoots(dataDir?: string): ResourceRoots {
	if (dataDir) {
		return {
			skills: [join(dataDir, 'skills')],
			prompts: [join(dataDir, 'prompts')],
			agentsFiles: [join(dataDir, 'AGENTS.md')],
		};
	}
	const home = homedir();
	const configured = process.env.PI_CODING_AGENT_DIR;
	const piAgent = configured
		? configured.replace(/^~(?=$|[\\/])/, home)
		: join(home, '.pi', 'agent');
	const sharedAgent = join(home, '.agents');
	return {
		skills: [join(piAgent, 'skills'), join(sharedAgent, 'skills')],
		prompts: [join(piAgent, 'prompts'), join(sharedAgent, 'prompts')],
		agentsFiles: [join(piAgent, 'AGENTS.md')],
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
	dataDir?: string,
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

/** Legacy explicit migration helper. Normal discovery no longer copies Pi
 * resources because Pi's directory is the canonical source. */
export async function adoptPiResources(
	dataDir?: string,
	piAgentDir = join(homedir(), '.pi', 'agent'),
): Promise<boolean> {
	// With no migration target, Pi's own directories are canonical.
	if (!dataDir) return false;
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
