import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const rust = Bun.spawnSync(['rustc', '-vV'], { cwd: root });
if (rust.exitCode !== 0) {
	throw new Error(new TextDecoder().decode(rust.stderr));
}
const host = new TextDecoder().decode(rust.stdout).match(/^host: (.+)$/m)?.[1];
if (!host) throw new Error('Could not determine the Rust host target');

const extension = host.includes('windows') ? '.exe' : '';
const output = join(
	root,
	'apps/app/src-tauri/binaries',
	`unity-agent-server-${host}${extension}`,
);
await mkdir(dirname(output), { recursive: true });

const build = Bun.spawnSync(
	[
		'bun',
		'build',
		'apps/agent-server/src/server.ts',
		'--compile',
		'--outfile',
		output,
	],
	{ cwd: root, stdout: 'inherit', stderr: 'inherit' },
);
if (build.exitCode !== 0) process.exit(build.exitCode);
