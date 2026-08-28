import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AskUserSource } from './ask-user-source';
import { AskUserWebSource } from './ask-user-web-source';

/**
 * First-party Pi extensions. These ship with Gizmo — the source is embedded
 * in the server (the compiled sidecar has no repo files on disk) and seeded
 * into the data dir at startup, where Pi loads them like any other
 * extension. A same-named extension in the user's agent dir takes precedence
 * over the shipped one.
 */

interface ShippedExtension {
	file: string;
	source: string;
}

const shipped: ShippedExtension[] = [
	{ file: 'ask-user.ts', source: AskUserSource },
	{ file: 'ask-user.web.js', source: AskUserWebSource },
];

/**
 * Writes every shipped extension into `<dataDir>/pi-extensions/` when the
 * file is missing or stale, and returns the paths to hand to Pi. A failure
 * to seed is logged, not thrown: a session still works without the shipped
 * tools.
 */
export async function seededPiExtensionPaths(
	dataDir: string,
): Promise<string[]> {
	const paths: string[] = [];
	for (const extension of shipped) {
		const file = join(dataDir, 'pi-extensions', extension.file);
		try {
			const current = await readFile(file, 'utf8').catch(() => undefined);
			if (current !== extension.source) {
				await mkdir(join(dataDir, 'pi-extensions'), { recursive: true });
				const temporary = `${file}.tmp`;
				await writeFile(temporary, extension.source);
				await rename(temporary, file);
			}
			paths.push(file);
		} catch (error) {
			console.error(`Could not seed Pi extension ${extension.file}:`, error);
		}
	}
	return paths;
}
