import { execFile } from 'node:child_process';
import { dirname } from 'node:path';

function exec(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { cwd, windowsHide: true }, (error, stdout) => {
			if (error) reject(new Error(String(error.message)));
			else resolve(String(stdout));
		});
	});
}

export function cloneRegistry(url: string, clone: string) {
	// git creates the target itself; it is spawned from the parent directory,
	// which the caller has already made.
	return exec(
		'git',
		['clone', '--depth', '1', url, clone],
		dirname(clone),
	).then(() => undefined);
}

export function pullRegistry(clone: string) {
	return exec('git', ['pull', '--ff-only'], clone).then(() => undefined);
}

export async function registryCommit(clone: string) {
	try {
		return (await exec('git', ['rev-parse', '--short', 'HEAD'], clone)).trim();
	} catch {
		return undefined;
	}
}

/** Checks the source without changing the managed clone or its refs. */
export async function registryUpdateAvailable(clone: string) {
	try {
		const [local, remote] = await Promise.all([
			exec('git', ['rev-parse', 'HEAD'], clone),
			exec('git', ['ls-remote', 'origin', 'HEAD'], clone),
		]);
		const remoteCommit = remote.trim().split(/\s+/)[0];
		return Boolean(remoteCommit) && local.trim() !== remoteCommit;
	} catch {
		// An unavailable source should not make the registry catalog unusable.
		return false;
	}
}

export function buildRegistry(command: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(
			command,
			{
				cwd,
				shell: true,
				windowsHide: true,
				// Registry builds are spawned without a terminal. Package managers
				// use CI to choose their non-interactive, deterministic behavior.
				env: { ...process.env, CI: process.env.CI || 'true' },
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(
						new Error(
							[error.message, stdout, stderr].filter(Boolean).join('\n'),
						),
					);
				} else resolve();
			},
		);
	});
}
