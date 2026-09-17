/**
 * Usage: node --experimental-strip-types cli.ts <extension-dir> --out <file>
 *
 * The agent-server runs this in a child process so Vite and the Svelte
 * compiler never block its event loop while a bundle builds.
 */
import { join } from 'node:path';
import { buildWebExtension } from './build-web-extension.ts';

const [packageDir, ...rest] = process.argv.slice(2);
if (!packageDir) {
	console.error('Usage: cli.ts <extension-dir> [--out <file>]');
	process.exit(1);
}
const outIndex = rest.indexOf('--out');
const outFile =
	outIndex >= 0 ? rest[outIndex + 1]! : join(packageDir, 'dist/web.js');
console.log(await buildWebExtension(packageDir, outFile));
