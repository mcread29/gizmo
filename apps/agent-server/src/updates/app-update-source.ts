import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The repository releases are published from; the same one the CLI reads. */
export const releaseRepository = 'mcread29/gizmo';

export interface InstallInfo {
	kind: 'release' | 'source';
	/** The tag for a release, the short commit for a checkout. */
	version: string;
	/** Full commit, for comparing a checkout with its remote. */
	commit?: string;
	/** The checkout's branch; what an update pulls. */
	branch?: string;
}

export interface LatestInfo {
	/** The newest tag, or the remote branch tip's short commit. */
	version: string;
	commit?: string;
}

/** `v1.2.3` sorts after `v1.2.2`; anything unparsable sorts first. */
export function compareVersions(left: string, right: string): number {
	const parse = (value: string) =>
		value
			.replace(/^v/, '')
			.split('.')
			.map((part) => Number.parseInt(part, 10) || 0);
	const [a, b] = [parse(left), parse(right)];
	for (let index = 0; index < 3; index += 1) {
		if ((a[index] ?? 0) !== (b[index] ?? 0))
			return (a[index] ?? 0) - (b[index] ?? 0);
	}
	return 0;
}

function git(args: string[], cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', args, { cwd, windowsHide: true }, (error, stdout) => {
			if (error) reject(new Error(String(error.message)));
			else resolve(String(stdout).trim());
		});
	});
}

/**
 * A release tarball carries `RELEASE.json`; a checkout has none and is
 * described by git instead.
 */
export async function installedVersion(root: string): Promise<InstallInfo> {
	try {
		const manifest = JSON.parse(
			await readFile(join(root, 'RELEASE.json'), 'utf8'),
		) as { version?: string; commit?: string };
		if (manifest.version) {
			return {
				kind: 'release',
				version: manifest.version,
				...(manifest.commit ? { commit: manifest.commit } : {}),
			};
		}
	} catch {
		// Not a release: fall through to git.
	}
	const [commit, branch] = await Promise.all([
		git(['rev-parse', 'HEAD'], root),
		git(['rev-parse', '--abbrev-ref', 'HEAD'], root),
	]);
	return { kind: 'source', version: commit.slice(0, 7), commit, branch };
}

/**
 * For a release, GitHub's latest release tag. For a checkout, the tip of
 * its branch on `origin`, read with `ls-remote` so nothing local changes.
 */
export async function latestVersion(
	install: InstallInfo,
	root: string,
): Promise<LatestInfo> {
	if (install.kind === 'source') {
		if (!install.branch || install.branch === 'HEAD')
			throw new Error('The checkout is not on a branch.');
		const remote = await git(
			['ls-remote', 'origin', `refs/heads/${install.branch}`],
			root,
		);
		const commit = remote.split(/\s+/)[0];
		if (!commit) throw new Error(`origin has no branch ${install.branch}.`);
		return { version: commit.slice(0, 7), commit };
	}
	const response = await fetch(
		`https://api.github.com/repos/${releaseRepository}/releases/latest`,
		{ headers: { accept: 'application/vnd.github+json' } },
	);
	if (!response.ok) {
		throw new Error(
			`Could not ask GitHub for the latest release (HTTP ${String(response.status)}).`,
		);
	}
	const release = (await response.json()) as { tag_name?: string };
	if (!release.tag_name) throw new Error('The latest release has no tag.');
	return { version: release.tag_name };
}
