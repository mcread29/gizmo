import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const root = join(__dirname, '..', '..');
export const runtimeDirectory = join(root, '.gizmo-dev');
export const stateFile = join(runtimeDirectory, 'dev-server.json');
export const logFile = join(runtimeDirectory, 'dev-server.log');

export interface DevServerState {
	pid: number;
	startedAt: string;
}

export function isRunning(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function readState() {
	try {
		const value = JSON.parse(
			await readFile(stateFile, 'utf8'),
		) as Partial<DevServerState>;
		if (
			typeof value.pid === 'number' &&
			Number.isInteger(value.pid) &&
			value.pid > 0 &&
			typeof value.startedAt === 'string'
		) {
			return value as DevServerState;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	return undefined;
}

export async function writeState(state: DevServerState) {
	await mkdir(dirname(stateFile), { recursive: true });
	const temporaryFile = `${stateFile}.${process.pid}.tmp`;
	await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`);
	await rename(temporaryFile, stateFile);
}

export function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
