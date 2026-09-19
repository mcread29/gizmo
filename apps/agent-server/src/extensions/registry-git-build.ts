import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function exec(command: string, args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { cwd, windowsHide: true }, (error, stdout) => {
			if (error) reject(new Error(String(error.message)));
			else resolve(String(stdout));
		});
	});
}

export function cloneRegistry(url: string, clone: string, ref: string) {
	// git creates the target itself; it is spawned from the parent directory,
	// which the caller has already made.
	return exec(
		'git',
		['clone', '--depth', '1', '--branch', ref, url, clone],
		dirname(clone),
	).then(() => undefined);
}

/**
 * Moves the managed clone to the tip of `ref`. The clone is never edited by
 * hand, so a detached checkout of what was fetched is all it needs; this
 * also carries a clone made before branches were pinned onto the right one.
 */
export async function pullRegistry(
	clone: string,
	ref: string,
	validate?: (manifest: import('./registry-storage').RegistryManifest) => void,
) {
	await exec('git', ['fetch', '--depth', '1', 'origin', ref], clone);
	if (validate) {
		const manifest = await exec(
			'git',
			['show', 'FETCH_HEAD:gizmo.registry.json'],
			clone,
		);
		validate(JSON.parse(manifest));
	}
	await exec('git', ['checkout', '--detach', '-q', 'FETCH_HEAD'], clone);
}

export async function registryCommit(clone: string) {
	try {
		return (await exec('git', ['rev-parse', '--short', 'HEAD'], clone)).trim();
	} catch {
		return undefined;
	}
}

/** Checks the source without changing the managed clone or its refs. */
export async function registryUpdateAvailable(clone: string, ref = 'HEAD') {
	try {
		const [local, remote] = await Promise.all([
			exec('git', ['rev-parse', 'HEAD'], clone),
			exec(
				'git',
				['ls-remote', 'origin', ref === 'HEAD' ? 'HEAD' : `refs/heads/${ref}`],
				clone,
			),
		]);
		const remoteCommit = remote.trim().split(/\s+/)[0];
		return Boolean(remoteCommit) && local.trim() !== remoteCommit;
	} catch {
		// An unavailable source should not make the registry catalog unusable.
		return false;
	}
}

/**
 * Installs the registry's server-side dependencies. There is nothing to
 * build: extensions are TypeScript the host evaluates as-is. A registry
 * without a lockfile has no dependencies and is left alone.
 */
export async function installRegistryDependencies(
	clone: string,
): Promise<void> {
	if (!existsSync(join(clone, 'pnpm-lock.yaml'))) return;
	await new Promise<void>((resolve, reject) => {
		execFile(
			'pnpm install --frozen-lockfile --ignore-scripts',
			{
				cwd: clone,
				shell: true,
				windowsHide: true,
				// Spawned without a terminal. Package managers use CI to choose
				// their non-interactive, deterministic behavior.
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
