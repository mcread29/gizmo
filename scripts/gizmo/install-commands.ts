import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import {
	appHome,
	appRoot,
	dataDir,
	releaseManifestFile,
	releasesDir,
	windowsLauncher,
} from './paths';
import {
	fetchVerifiedTarball,
	latestReleaseTag,
	readReleaseManifest,
	unpackTarball,
} from './release-download';
import {
	currentVersion,
	installedReleases,
	pointCurrent,
	previousRelease,
	pruneReleases,
} from './releases-store';
import { pnpmEnvironment, pnpmExecutable } from './pnpm';
import { restartService, waitUntilHealthy } from './service';
import { runningVersion } from './running';
import { uninstallService } from './service-platform';

const shell = process.platform === 'win32';

function run(command: string, args: string[], cwd: string) {
	// Through a shell the command is not quoted for us, and a Windows Node
	// (and so its pnpm shim) often lives under `Program Files`. Node warns
	// (DEP0190) when `args` are passed alongside `shell`, since it only
	// concatenates them, so we do the concatenation and the quoting here.
	const line = [`"${command}"`, ...args.map((arg) => `"${arg}"`)].join(' ');
	const result = spawnSync(shell ? line : command, shell ? [] : args, {
		cwd,
		stdio: 'inherit',
		shell,
		env: pnpmEnvironment(),
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed in ${cwd}.`);
	}
}

const pnpm = (args: string[], cwd: string) => run(pnpmExecutable(), args, cwd);

/** A checkout has no `RELEASE.json`, and is updated with git rather than a tarball. */
export async function isSourceInstall(root = appRoot): Promise<boolean> {
	return (await readReleaseManifest(releaseManifestFile(root))) === null;
}

/**
 * Adopts the tree this CLI is running from: what the one-line installer calls
 * once it has unpacked a tarball into `releases/` and installed its
 * dependencies. There is nothing left to download.
 */
export async function adoptCurrentTree(root = appRoot): Promise<string> {
	await pointCurrent(root);
	await pruneOldReleases();
	console.log(`current -> ${root}`);
	return (await currentVersion()) ?? root;
}

/**
 * Unpacking replaces the target directory, so the release that is serving
 * cannot be the target: on Windows the running server holds its files open
 * and the delete fails with `EBUSY`, and on any platform it would pull the
 * code out from under the live process. Reinstalling the running version is
 * a repair, and needs the service stopped first.
 */
function refuseToReplaceLiveRelease(version: string, current: string | null) {
	if (version !== current) return;
	throw new Error(
		`${version} is the release that is currently running, and unpacking ` +
			'over it would delete the files the live server is using. Run ' +
			'`gizmo service stop` first to reinstall it, or `gizmo update` to ' +
			'move to a different version.',
	);
}

/**
 * Unpacks beside whatever is running and only moves `current` once
 * dependencies are in, so a failed download or install leaves the live
 * instance serving.
 */
export async function installRelease(requested?: string): Promise<string> {
	const version = requested ?? (await latestReleaseTag());
	refuseToReplaceLiveRelease(version, await currentVersion());
	const target = join(releasesDir(), version);
	console.log(`Installing ${version} into ${target}`);
	const archive = await fetchVerifiedTarball(version);
	await unpackTarball(archive, target);
	await rm(archive, { force: true });
	pnpm(['install', '--frozen-lockfile'], target);
	await pointCurrent(target);
	console.log(`current -> ${target}`);
	return version;
}

/**
 * Runs after the new server is up: on Windows the old release's directory
 * is locked for as long as its process runs, so pruning before the restart
 * fails with EBUSY. A locked directory is reported, not fatal; the next
 * update gets it.
 */
async function pruneOldReleases() {
	const { removed, locked } = await pruneReleases();
	for (const path of removed) console.log(`Removed old release ${path}`);
	for (const { path, message } of locked) {
		console.log(`Could not remove ${path} yet (${message}).`);
	}
	if (locked.length) {
		console.log('The next update will try again, or delete it by hand.');
	}
}

function updateSourceCheckout(root: string) {
	run('git', ['pull', '--ff-only'], root);
	pnpm(['install', '--frozen-lockfile'], root);
	pnpm(['build'], root);
}

/**
 * With `restart: false` the new release is installed and `current` moved,
 * but the running server is left alone. That is how the server updates
 * itself from the browser: it cannot restart its own service from inside
 * the service, since the stop would end this very CLI along with it, so it
 * exits once this returns and lets the supervisor bring up `current`.
 */
export async function updateCommand(
	requested?: string,
	{ restart = true, root = appRoot }: { restart?: boolean; root?: string } = {},
) {
	let target: string;
	let installed = true;
	if (await isSourceInstall(root)) {
		if (requested) {
			throw new Error(
				'This is a source install; check out the tag you want, then run `gizmo update`.',
			);
		}
		updateSourceCheckout(root);
		target = 'source';
	} else {
		target = requested ?? (await latestReleaseTag());
		const plan = await planFor(target);
		if (plan === 'nothing') return;
		installed = plan === 'install';
		if (installed) await installRelease(target);
	}
	if (!restart) {
		await pruneOldReleases();
		console.log(
			installed
				? 'Installed. Restart the service to run it.'
				: `${target} is ready. Restart the service to run it.`,
		);
		return;
	}
	restartService();
	await waitUntilHealthy(target);
	await pruneOldReleases();
}

/**
 * Deciding this before anything is downloaded keeps a second `update` cheap:
 * reinstalling the live release cannot work, and restarting a server that is
 * already on the right version only drops the devices connected to it.
 *
 * `current` is not the test, though. It is moved before the restart, so an
 * update whose restart failed leaves the link on the new release and the old
 * server still serving — and `update` would then keep answering "Already on
 * X" while X was nowhere near the browser. When the link and the running
 * server disagree, there is nothing to install but everything still to
 * restart, so this falls through with the download skipped.
 */
async function planFor(
	version: string,
): Promise<'install' | 'restart' | 'nothing'> {
	if (version !== (await currentVersion())) return 'install';
	const live = runningVersion();
	if (live === version) {
		console.log(
			`Already on ${version}. ` +
				'Run `gizmo service restart` if you meant to restart it.',
		);
		return 'nothing';
	}
	console.log(
		live
			? `${version} is installed, but ${live} is still serving. ` +
					'Restarting to finish the update.'
			: `${version} is installed, but nothing recorded is serving it. ` +
					'Restarting to bring it up.',
	);
	return 'restart';
}

export async function rollbackCommand() {
	const target = await previousRelease();
	if (!target) throw new Error('There is no previous release to roll back to.');
	await pointCurrent(join(releasesDir(), target));
	console.log(`current -> ${join(releasesDir(), target)}`);
	restartService();
	await waitUntilHealthy(target);
}

export async function listCommand() {
	const live = await currentVersion();
	const releases = await installedReleases();
	if (await isSourceInstall()) console.log(`source install at ${appRoot}`);
	if (!releases.length) {
		console.log('No releases installed.');
		return;
	}
	for (const version of releases) {
		console.log(`${version === live ? '*' : ' '} ${version}`);
	}
}

async function confirm(question: string): Promise<boolean> {
	const reader = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	try {
		return (
			(await reader.question(`${question} [y/N] `)).trim().toLowerCase() === 'y'
		);
	} finally {
		reader.close();
	}
}

/**
 * Without `--purge`, sessions, settings, memory and linked extensions survive
 * and a reinstall picks them up. Either way `~/.pi/agent` is the Pi CLI's and
 * is never touched.
 */
export async function uninstallCommand(purge: boolean, assumeYes: boolean) {
	const doomed = purge ? [dataDir()] : [appHome(), windowsLauncher()];
	console.log('This will stop and unregister the Gizmo service and delete:');
	for (const path of doomed) console.log(`  ${path}`);
	if (purge) {
		console.log(
			'\n--purge also removes sessions, settings, memory, the registry clone\n' +
				'and every extension link Gizmo made. Hand-written extensions outside\n' +
				`${dataDir()} are your own files and stay where they are.`,
		);
	}
	if (!assumeYes && !(await confirm('\nProceed?'))) {
		console.log('Nothing was removed.');
		return;
	}
	for (const name of await uninstallService()) console.log(`Removed ${name}`);
	for (const path of doomed) await rm(path, { recursive: true, force: true });
	console.log('Done.');
}
