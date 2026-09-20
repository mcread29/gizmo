import { homedir } from 'node:os';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The source tree this CLI is running from. For a release install that is
 * `~/.gizmo/app/current`; for a `source` install it is the checkout. Either
 * way it is the directory two levels above this file, so nothing has to be
 * told where the app lives.
 */
export const appRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
);

/** Everything Gizmo installs or writes lives under here. */
export const dataDir = () =>
	process.env.GIZMO_DATA_DIR ?? join(homedir(), '.gizmo');

export const appHome = () => join(dataDir(), 'app');
export const releasesDir = () => join(appHome(), 'releases');
/** Symlink (junction on Windows) at `app/current` pointing at the live tree. */
export const currentLink = () => join(appHome(), 'current');
/**
 * The tree a supervisor should be told to run. Node resolves the `current`
 * junction before `import.meta.url` is set, so `appRoot` names one pinned
 * release; a service registered against it would keep running that release
 * after every `update` swapped the link. Release installs therefore point
 * the service at `current` itself. A source checkout is its own root.
 */
export function serviceRoot(root = appRoot, releases = releasesDir()): string {
	const inside = relative(releases, root);
	const isRelease =
		inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
	return isRelease ? currentLink() : root;
}

/** The Windows launcher the scheduled task runs; carries `GIZMO_DATA_DIR`. */
export const windowsLauncher = () => join(appHome(), 'startup.cmd');

export const logsDir = () => join(dataDir(), 'logs');
export const webLogFile = () => join(logsDir(), 'web.log');

export const webConfigFile = () => join(dataDir(), 'web.json');

/** Written into every release tarball; absent from a `source` install. */
export const releaseManifestFile = (root = appRoot) =>
	join(root, 'RELEASE.json');
