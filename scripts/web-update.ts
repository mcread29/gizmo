import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(__dirname, '..');
const shell = process.platform === 'win32';

function run(command: string, args: string[]) {
	return (
		spawnSync(command, args, {
			cwd: root,
			stdio: 'inherit',
			shell,
		}).status ?? 1
	);
}

// A failed build leaves the running instance serving the last good bundle.
if (run('pnpm', ['-C', 'apps/app', 'build']) !== 0) {
	process.exit(1);
}

// Restarting replaces the daemon process, so the new one must be started the
// way the machine starts it: `.gizmo-web/startup.cmd` is the scheduled-task
// launcher and carries the machine-local environment (`GIZMO_WEB_HOSTS`,
// ports) that makes the instance reachable by its Tailscale name. Starting
// through the bare script instead would quietly drop those hosts.
run('pnpm', ['web:server', 'stop']);
const launcher = join(root, '.gizmo-web', 'startup.cmd');
if (process.platform === 'win32' && existsSync(launcher)) {
	run('cmd.exe', ['/c', launcher]);
} else {
	run('pnpm', ['web:server', 'start']);
}
