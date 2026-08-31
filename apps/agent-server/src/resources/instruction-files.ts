import {
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type {
	InstructionFile,
	InstructionTarget,
	StoredProject,
} from '@gizmo/protocol';
import { defaultDataDir } from '../sessions/session-repository';
import { globalResourceRoots } from './resource-paths';

const maxBytes = 1_000_000;

/** Where each editable instruction file lives on disk. */
export function instructionFilePath(
	target: InstructionTarget,
	workspacePath?: string,
): string {
	switch (target) {
		case 'system-prompt':
			return join(defaultDataDir(), 'system-prompt.md');
		case 'global-agents':
			return globalResourceRoots().agentsFiles[0]!;
		case 'project-agents': {
			if (!workspacePath) {
				throw new Error(
					'A workspace path is required for project instructions',
				);
			}
			return join(workspacePath, 'AGENTS.md');
		}
	}
}

/**
 * Pi's own default system prompt isn't exported by the SDK as a standalone
 * value; it's only produced as a side effect of building a session. A real
 * session's result is cached here (see recordDefaultSystemPrompt) and, when
 * nothing has been cached yet, a disposable session is spun up on demand.
 */
let observedDefaultSystemPrompt: string | undefined;
let pendingDefaultSystemPrompt: Promise<string | undefined> | undefined;

export function recordDefaultSystemPrompt(prompt: string | undefined): void {
	if (prompt) observedDefaultSystemPrompt = prompt;
}

async function defaultSystemPrompt(): Promise<string | undefined> {
	if (observedDefaultSystemPrompt) return observedDefaultSystemPrompt;
	pendingDefaultSystemPrompt ??= computeDefaultSystemPrompt();
	return pendingDefaultSystemPrompt;
}

async function computeDefaultSystemPrompt(): Promise<string | undefined> {
	try {
		const {
			createAgentSessionFromServices,
			createAgentSessionServices,
			getAgentDir,
			SessionManager,
		} = await import('@earendil-works/pi-coding-agent');
		const cwd = process.cwd();
		const agentDir =
			process.env.GIZMO_PI_WEB === '1' ? getAgentDir() : defaultDataDir();
		const { session } = await createAgentSessionFromServices({
			services: await createAgentSessionServices({ cwd, agentDir }),
			sessionManager: SessionManager.create(cwd, agentDir),
		});
		try {
			observedDefaultSystemPrompt = session.systemPrompt || undefined;
			return observedDefaultSystemPrompt;
		} finally {
			session.dispose();
		}
	} catch {
		return undefined;
	} finally {
		pendingDefaultSystemPrompt = undefined;
	}
}

/**
 * A missing file reads as empty so the editor can create it on save, except
 * the system prompt, which prefills with Pi's current default so the user is
 * editing a copy of it rather than starting from a blank slate.
 */
export async function readInstructionFile(
	target: InstructionTarget,
	workspacePath?: string,
): Promise<InstructionFile> {
	const path = await safeInstructionPath(target, workspacePath);
	try {
		const content = await readFile(path, 'utf8');
		if (Buffer.byteLength(content, 'utf8') > maxBytes) {
			throw new Error('Instruction files larger than 1 MB cannot be edited');
		}
		return { target, path, content, exists: true };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		const content =
			target === 'system-prompt' ? ((await defaultSystemPrompt()) ?? '') : '';
		return { target, path, content, exists: false };
	}
}

export async function writeInstructionFile(
	target: InstructionTarget,
	content: string,
	workspacePath?: string,
): Promise<InstructionFile> {
	if (Buffer.byteLength(content, 'utf8') > maxBytes) {
		throw new Error('Instruction files cannot exceed 1 MB');
	}
	const path = await safeInstructionPath(target, workspacePath);
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.gizmo.tmp`;
	await writeFile(temporary, content, 'utf8');
	await rename(temporary, path);
	return { target, path, content, exists: true };
}

type ProjectLister = () => Promise<StoredProject[]>;

export async function handleInstructionsRead(
	listProjects: ProjectLister,
	target: InstructionTarget,
	workspacePath?: string,
): Promise<InstructionFile> {
	return readInstructionFile(
		target,
		await instructionWorkspace(listProjects, target, workspacePath),
	);
}

export async function handleInstructionsWrite(
	listProjects: ProjectLister,
	target: InstructionTarget,
	content: string,
	workspacePath?: string,
): Promise<InstructionFile> {
	return writeInstructionFile(
		target,
		content,
		await instructionWorkspace(listProjects, target, workspacePath),
	);
}

/** Project instructions may only touch AGENTS.md in a registered workspace. */
async function instructionWorkspace(
	listProjects: ProjectLister,
	target: InstructionTarget,
	workspacePath?: string,
): Promise<string | undefined> {
	if (target !== 'project-agents') return undefined;
	if (!workspacePath) {
		throw new Error('A workspace path is required for project instructions');
	}
	if (!(await listProjects()).some(({ path }) => path === workspacePath)) {
		throw new Error(`Unknown workspace: ${workspacePath}`);
	}
	return workspacePath;
}

/** The user's saved system prompt override, if any; applied at session start. */
export async function userSystemPrompt(): Promise<string | undefined> {
	try {
		const content = await readFile(
			instructionFilePath('system-prompt'),
			'utf8',
		);
		return content.trim() || undefined;
	} catch {
		return undefined;
	}
}

async function safeInstructionPath(
	target: InstructionTarget,
	workspacePath?: string,
): Promise<string> {
	const path = resolve(instructionFilePath(target, workspacePath));
	try {
		if (
			(await lstat(path)).isSymbolicLink() ||
			resolve(await realpath(path)) !== path
		) {
			throw new Error('Symlinked instruction files cannot be edited');
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	return path;
}
