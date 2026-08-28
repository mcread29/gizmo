import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildWebExtension } from '../apps/app/scripts/build-web-extension.ts';

/**
 * Builds the web UI of every pi-extension that ships one. Each extension
 * directory under pi-extensions/ may contain `src/web/index.ts`; the output
 * is a sibling `<name>.web.js` — the file that travels with the extension
 * when it is installed into a Pi agent directory, and that Gizmo serves as
 * a runtime web extension paired by stem.
 *
 * Nothing here is packaged into the compiled server; the outputs are plain
 * files that live beside the extension.
 */

async function main() {
	const root = join(import.meta.dirname, '..', 'pi-extensions');

	const directories = (await readdir(root, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	for (const name of directories) {
		const packageDir = join(root, name);
		const out = join(root, `${name}.web.js`);
		console.log(await buildWebExtension(packageDir, out));
	}
}

main();
