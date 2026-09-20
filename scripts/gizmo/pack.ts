/**
 * A release ships what git tracks, not the working tree: a blacklist lets
 * `.env`, logs and every nested `node_modules` through, and there is no
 * exclude pattern that reliably catches all of them on both tars. These are
 * the tracked paths a release still has no use for — the registry is a
 * submodule cloned at runtime, the rest is repository furniture.
 */
export const excludedFromRelease = [
	'.github',
	'extensions/registry',
	'research',
	'screenshots',
	'skills-ref',
] as const;

const excluded = (path: string) =>
	excludedFromRelease.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);

/**
 * `tracked` is `git ls-files`; `built` is the browser bundle, which is
 * ignored by git and is the one thing a release adds to the source tree.
 */
export function selectReleaseFiles(
	tracked: readonly string[],
	built: readonly string[],
): string[] {
	const files = new Set<string>();
	for (const path of [...tracked, ...built]) {
		const normalised = path.replaceAll('\\', '/').trim();
		if (normalised && !excluded(normalised)) files.add(normalised);
	}
	files.add('RELEASE.json');
	return [...files].sort();
}

export interface ReleaseManifest {
	version: string;
	commit: string;
	extensionApiVersion: number;
	registryRef: string;
}

export const manifestJson = (manifest: ReleaseManifest) =>
	`${JSON.stringify(manifest, null, '\t')}\n`;

/**
 * The tag body. `WORKLOG.md` is written a dated section at a time, so the
 * release notes are the section naming this version if there is one, and the
 * newest section otherwise.
 */
export function releaseNotes(worklog: string, version: string): string {
	const sections = worklog.split(/^## /m).slice(1);
	if (!sections.length) return version;
	const named = sections.find((section) =>
		section.split('\n', 1)[0].includes(version),
	);
	return `## ${(named ?? sections[0]).trimEnd()}\n`;
}

/** `SHA256SUMS`, in the format `sha256sum -c` reads back. */
export const checksumLine = (digest: string, name: string) =>
	`${digest}  ${name}\n`;
