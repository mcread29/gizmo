import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, posix, win32 } from 'node:path';

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
 * Where `pnpm` lives when the service has no useful PATH. The one-line
 * installer requires pnpm through `corepack enable`, which puts the shim
 * beside the `node` the supervisor was registered with, so that directory is
 * tried first; `corepack pnpm` covers a Node that ships corepack but was not
 * enabled. A bare `pnpm` on PATH is the last resort, for source checkouts run
 * from a shell.
 */
export function pnpmCommand(
	nodeExe = process.execPath,
	platform = process.platform,
	exists: (path: string) => boolean = existsSync,
): { command: string; args: string[] } {
	const path = platform === 'win32' ? win32 : posix;
	const bin = path.dirname(nodeExe);
	const ext = platform === 'win32' ? '.cmd' : '';
	const pnpm = path.join(bin, `pnpm${ext}`);
	if (exists(pnpm)) return { command: pnpm, args: [] };
	const corepack = path.join(bin, `corepack${ext}`);
	if (exists(corepack)) return { command: corepack, args: ['pnpm'] };
	return { command: `pnpm${ext}`, args: [] };
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
	const pnpm = pnpmCommand();
	const windows = process.platform === 'win32';
	await new Promise<void>((resolve, reject) => {
		execFile(
			// Through a shell the command is not quoted for us, and a Windows
			// Node often lives under `Program Files`.
			windows ? `"${pnpm.command}"` : pnpm.command,
			[...pnpm.args, 'install', '--frozen-lockfile', '--ignore-scripts'],
			{
				cwd: clone,
				// `.cmd` shims on Windows only run through a shell.
				shell: windows,
				windowsHide: true,
				env: {
					...process.env,
					// Spawned without a terminal. Package managers use CI to choose
					// their non-interactive, deterministic behavior.
					CI: process.env.CI || 'true',
					// The pnpm shim is a script that starts `node` from PATH, and a
					// supervisor's PATH need not name the Node the service runs.
					PATH: [dirname(process.execPath), process.env.PATH]
						.filter(Boolean)
						.join(delimiter),
				},
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(
						new Error(
							[`${pnpm.command} install failed`, error.message, stdout, stderr]
								.filter(Boolean)
								.join('\n'),
						),
					);
				} else resolve();
			},
		);
	});
}
