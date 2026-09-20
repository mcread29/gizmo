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
import { restartService, waitUntilHealthy } from './service';
import { uninstallService } from './service-platform';

const shell = process.platform === 'win32';

function run(command: string, args: string[], cwd: string) {
	const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell });
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed in ${cwd}.`);
	}
}

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
	const pruned = await pruneReleases();
	for (const path of pruned) console.log(`Removed old release ${path}`);
	console.log(`current -> ${root}`);
	return (await currentVersion()) ?? root;
}

/**
 * Unpacks beside whatever is running and only moves `current` once
 * dependencies are in, so a failed download or install leaves the live
 * instance serving.
 */
export async function installRelease(requested?: string): Promise<string> {
	const version = requested ?? (await latestReleaseTag());
	const target = join(releasesDir(), version);
	console.log(`Installing ${version} into ${target}`);
	const archive = await fetchVerifiedTarball(version);
	await unpackTarball(archive, target);
	await rm(archive, { force: true });
	run('pnpm', ['install', '--frozen-lockfile'], target);
	await pointCurrent(target);
	const pruned = await pruneReleases();
	for (const path of pruned) console.log(`Removed old release ${path}`);
	console.log(`current -> ${target}`);
	return version;
}

function updateSourceCheckout(root: string) {
	run('git', ['pull', '--ff-only'], root);
	run('pnpm', ['install', '--frozen-lockfile'], root);
	run('pnpm', ['build'], root);
}

export async function updateCommand(requested?: string) {
	if (await isSourceInstall()) {
		if (requested) {
			throw new Error(
				'This is a source install; check out the tag you want, then run `gizmo update`.',
			);
		}
		updateSourceCheckout(appRoot);
	} else {
		await installRelease(requested);
	}
	restartService();
	await waitUntilHealthy();
}

export async function rollbackCommand() {
	const target = await previousRelease();
	if (!target) throw new Error('There is no previous release to roll back to.');
	await pointCurrent(join(releasesDir(), target));
	console.log(`current -> ${join(releasesDir(), target)}`);
	restartService();
	await waitUntilHealthy();
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
