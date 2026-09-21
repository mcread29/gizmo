import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

/**
 * Which `pnpm` to run. From a shell a bare `pnpm` is on PATH, but when the
 * server starts an update the CLI runs under the supervisor's PATH, which
 * need not name pnpm at all. The installer requires pnpm through
 * `corepack enable`, which puts the shim beside `node`, so that copy is
 * preferred and the bare name is the fallback.
 */
export function pnpmExecutable(
	nodeExe = process.execPath,
	platform = process.platform,
	exists: (path: string) => boolean = existsSync,
): string {
	const shim = join(
		dirname(nodeExe),
		platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
	);
	return exists(shim) ? shim : 'pnpm';
}

/**
 * The shim is a script that starts `node` by name, so the directory of the
 * Node running this CLI goes first on the child's PATH. `CI` keeps pnpm
 * non-interactive when there is no terminal.
 */
export function pnpmEnvironment(env = process.env): NodeJS.ProcessEnv {
	return {
		...env,
		CI: env.CI || 'true',
		PATH: [dirname(process.execPath), env.PATH].filter(Boolean).join(delimiter),
	};
}
