import { constants } from 'node:fs';
import { chmod, copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultDataDir } from '../sessions/session-repository';

const piConfigFiles = ['auth.json', 'settings.json', 'models.json'] as const;

export const defaultPiAgentDir = () => join(homedir(), '.pi', 'agent');

/** Paths used by Pi's SDK when it runs inside Gizmo. */
export interface GizmoPiRuntimePaths {
	agentDir: string;
	authPath: string;
	modelsPath: string;
	modelsStorePath: string;
}

export function gizmoPiRuntimePaths(
	dataDir = defaultDataDir(),
): GizmoPiRuntimePaths {
	return {
		agentDir: dataDir,
		authPath: join(dataDir, 'auth.json'),
		modelsPath: join(dataDir, 'models.json'),
		modelsStorePath: join(dataDir, 'models-store.json'),
	};
}

export function defaultPiRuntimePaths(
	agentDir = defaultPiAgentDir(),
): GizmoPiRuntimePaths {
	return {
		agentDir,
		authPath: join(agentDir, 'auth.json'),
		modelsPath: join(agentDir, 'models.json'),
		modelsStorePath: join(agentDir, 'models-store.json'),
	};
}

/**
 * Adopt existing Pi configuration once. Existing Gizmo files are authoritative:
 * COPYFILE_EXCL makes every import independently safe and non-destructive.
 */
export async function importPiRuntimeConfig(
	dataDir = defaultDataDir(),
	piAgentDir = defaultPiAgentDir(),
): Promise<string[]> {
	await mkdir(dataDir, { recursive: true, mode: 0o700 });
	const imported: string[] = [];
	for (const file of piConfigFiles) {
		const destination = join(dataDir, file);
		try {
			await copyFile(
				join(piAgentDir, file),
				destination,
				constants.COPYFILE_EXCL,
			);
			// These files may contain credentials directly or references to them.
			await chmod(destination, 0o600);
			imported.push(file);
		} catch (error) {
			if (isExpectedImportMiss(error)) continue;
			throw error;
		}
	}
	return imported;
}

/** Explicitly replace Gizmo's auth with Pi's current auth, atomically. */
export async function reimportPiAuth(
	dataDir = defaultDataDir(),
	piAgentDir = defaultPiAgentDir(),
): Promise<void> {
	await mkdir(dataDir, { recursive: true, mode: 0o700 });
	const destination = join(dataDir, 'auth.json');
	const temporary = `${destination}.${randomUUID()}.tmp`;
	try {
		await copyFile(join(piAgentDir, 'auth.json'), temporary);
		await chmod(temporary, 0o600);
		await rename(temporary, destination);
	} finally {
		await rm(temporary, { force: true });
	}
}

function isExpectedImportMiss(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		(error.code === 'ENOENT' || error.code === 'EEXIST')
	);
}
