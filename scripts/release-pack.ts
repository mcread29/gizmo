import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionApiVersion } from '@gizmo/extension-api';
import {
	checksumLine,
	manifestJson,
	releaseNotes,
	selectReleaseFiles,
} from './gizmo/pack';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(args: string[]) {
	const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed.`);
	return result.stdout.trim();
}

/** The built browser bundle, which git does not track but a release needs. */
async function builtBundle(): Promise<string[]> {
	const directory = join(root, 'apps', 'app', 'dist');
	const entries = await readdir(directory, {
		recursive: true,
		withFileTypes: true,
	}).catch(() => {
		throw new Error('apps/app/dist is missing. Run `pnpm build` first.');
	});
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) =>
			relative(root, join(entry.parentPath, entry.name))
				.split(sep)
				.join(posix.sep),
		);
}

/**
 * Builds the release assets: the tarball the installer downloads, its
 * checksum, and the notes that become the tag body. Run by
 * `.github/workflows/release.yml` after check, test and build have passed.
 */
async function main() {
	const version =
		process.argv[2] ?? git(['describe', '--tags', '--exact-match']);
	const outputDirectory = process.argv[3] ?? join(root, '.artifacts');
	await mkdir(outputDirectory, { recursive: true });

	// The registry branch this build follows; mirrors `registry-storage.ts`,
	// which derives it from the same number.
	const manifest = {
		version,
		commit: git(['rev-parse', 'HEAD']),
		extensionApiVersion,
		registryRef: `v${String(extensionApiVersion)}`,
	};
	await writeFile(join(root, 'RELEASE.json'), manifestJson(manifest), 'utf8');

	// `git ls-files` still names files deleted in the working tree. A tag build
	// is clean so this drops nothing; packing from a dirty checkout, it is the
	// difference between a tarball and a `tar: Cannot stat` failure.
	const selected = selectReleaseFiles(
		git(['ls-files']).split('\n'),
		await builtBundle(),
	);
	const files = selected.filter((file) => existsSync(join(root, file)));
	for (const missing of selected.filter((file) => !files.includes(file))) {
		console.warn(`skipping ${missing}: deleted in the working tree`);
	}
	const fileList = join(outputDirectory, 'FILES');
	await writeFile(fileList, files.map((file) => `${file}\n`).join(''), 'utf8');

	const name = `gizmo-${version}.tar.gz`;
	const archive = join(outputDirectory, name);
	const tar = spawnSync('tar', ['-czf', archive, '-C', root, '-T', fileList], {
		stdio: 'inherit',
	});
	if (tar.status !== 0)
		throw new Error('tar failed to build the release archive.');

	const digest = createHash('sha256')
		.update(await readFile(archive))
		.digest('hex');
	await writeFile(
		join(outputDirectory, 'SHA256SUMS'),
		checksumLine(digest, name),
		'utf8',
	);
	await writeFile(
		join(outputDirectory, 'NOTES.md'),
		releaseNotes(await readFile(join(root, 'WORKLOG.md'), 'utf8'), version),
		'utf8',
	);
	console.log(`${archive}\n${digest}  ${name}`);
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
