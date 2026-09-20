import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import {
	isAccessDenied,
	launchdPlist,
	serviceNames,
	systemdUnit,
	windowsElevationMessage,
	windowsLauncherScript,
	windowsTaskXml,
	type ServiceCommand,
} from './service-definition';
import { serviceRoot, webLogFile, windowsLauncher } from './paths';

export type Platform = 'linux' | 'darwin' | 'win32';

export function currentPlatform(): Platform {
	if (process.platform === 'linux') return 'linux';
	if (process.platform === 'darwin') return 'darwin';
	if (process.platform === 'win32') return 'win32';
	throw new Error(`Gizmo has no service definition for ${process.platform}.`);
}

export const systemdUnitFile = () =>
	join(homedir(), '.config', 'systemd', 'user', serviceNames.systemdUnit);
export const launchAgentFile = () =>
	join(
		homedir(),
		'Library',
		'LaunchAgents',
		`${serviceNames.launchdLabel}.plist`,
	);

function run(command: string, args: string[], { quiet = false } = {}) {
	const result = spawnSync(command, args, {
		encoding: 'utf8',
		windowsHide: true,
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
	if (result.error) throw result.error;
	if (result.status !== 0 && !quiet) {
		throw new Error(`${command} ${args.join(' ')} failed:\n${output}`);
	}
	return { status: result.status ?? 1, output };
}

/**
 * What every supervisor is told to run. The `node` path is resolved here, at
 * install time, rather than looked up later: a login session's PATH is not
 * the one a version manager set up in an interactive shell. `tsx` is named
 * through `root/node_modules/tsx` rather than resolved, so the path stays
 * valid when a later release ships a different `tsx` version.
 */
export function serviceCommand(root = serviceRoot()): ServiceCommand {
	const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
	const env: Record<string, string> = {};
	if (process.env.GIZMO_DATA_DIR)
		env.GIZMO_DATA_DIR = process.env.GIZMO_DATA_DIR;
	return {
		exe: process.execPath,
		args: [tsxCli, join(root, 'scripts', 'gizmo.ts'), 'run'],
		cwd: root,
		env,
		logFile: webLogFile(),
	};
}

function schtasksError(verb: string, output: string): Error {
	if (isAccessDenied(output)) return new Error(windowsElevationMessage());
	return new Error(`schtasks ${verb} failed:\n${output}`);
}

/** The account an S4U task runs as; `schtasks` will not infer it for us. */
function windowsUserId(): string {
	const user = process.env.USERNAME ?? userInfo().username;
	const domain = process.env.USERDOMAIN;
	return domain ? `${domain}\\${user}` : user;
}

/** `schtasks` only accepts UTF-16 task XML, BOM included. */
async function writeTaskXml(file: string, xml: string) {
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, `﻿${xml}`, 'utf16le');
}

async function installWindows(command: ServiceCommand) {
	const launcher = windowsLauncher();
	await mkdir(dirname(launcher), { recursive: true });
	await writeFile(launcher, windowsLauncherScript(command), 'utf8');
	const xmlFile = join(tmpdir(), `gizmo-task-${String(process.pid)}.xml`);
	await writeTaskXml(
		xmlFile,
		windowsTaskXml(launcher, command.cwd, windowsUserId()),
	);
	try {
		const created = run(
			'schtasks.exe',
			['/Create', '/TN', serviceNames.windowsTask, '/XML', xmlFile, '/F'],
			{ quiet: true },
		);
		if (created.status !== 0) throw schtasksError('/Create', created.output);
	} finally {
		await rm(xmlFile, { force: true });
	}
	return [launcher, `scheduled task "${serviceNames.windowsTask}"`];
}

async function installLinux(command: ServiceCommand) {
	const unit = systemdUnitFile();
	await mkdir(dirname(unit), { recursive: true });
	await writeFile(unit, systemdUnit(command), 'utf8');
	run('systemctl', ['--user', 'daemon-reload']);
	run('systemctl', ['--user', 'enable', serviceNames.systemdUnit]);
	// Without lingering the unit stops when the last session ends, which is
	// exactly when an always-on server is expected to keep running.
	run('loginctl', ['enable-linger', process.env.USER ?? ''], { quiet: true });
	return [unit, `systemd user unit ${serviceNames.systemdUnit}`];
}

async function installDarwin(command: ServiceCommand) {
	const plist = launchAgentFile();
	await mkdir(dirname(plist), { recursive: true });
	await writeFile(plist, launchdPlist(command), 'utf8');
	run('launchctl', ['bootout', guiTarget(), plist], { quiet: true });
	run('launchctl', ['bootstrap', guiTarget(), plist]);
	return [plist, `LaunchAgent ${serviceNames.launchdLabel}`];
}

const guiTarget = () => `gui/${String(process.getuid?.() ?? 501)}`;

export async function installService(root = serviceRoot()): Promise<string[]> {
	const command = serviceCommand(root);
	await mkdir(dirname(command.logFile), { recursive: true });
	if (currentPlatform() === 'win32') return installWindows(command);
	if (currentPlatform() === 'linux') return installLinux(command);
	return installDarwin(command);
}

export async function uninstallService(): Promise<string[]> {
	if (currentPlatform() === 'win32') {
		run('schtasks.exe', ['/End', '/TN', serviceNames.windowsTask], {
			quiet: true,
		});
		// A missing task is a fine outcome for uninstall; a missing privilege
		// is not, because it leaves the task running behind a success message.
		const deleted = run(
			'schtasks.exe',
			['/Delete', '/TN', serviceNames.windowsTask, '/F'],
			{ quiet: true },
		);
		if (deleted.status !== 0 && isAccessDenied(deleted.output)) {
			throw schtasksError('/Delete', deleted.output);
		}
		await rm(windowsLauncher(), { force: true });
		return [`scheduled task "${serviceNames.windowsTask}"`];
	}
	if (currentPlatform() === 'linux') {
		run('systemctl', ['--user', 'disable', '--now', serviceNames.systemdUnit], {
			quiet: true,
		});
		await rm(systemdUnitFile(), { force: true });
		run('systemctl', ['--user', 'daemon-reload'], { quiet: true });
		return [systemdUnitFile()];
	}
	run('launchctl', ['bootout', guiTarget(), launchAgentFile()], {
		quiet: true,
	});
	await rm(launchAgentFile(), { force: true });
	return [launchAgentFile()];
}

export function startService() {
	if (currentPlatform() === 'win32') {
		run('schtasks.exe', ['/Run', '/TN', serviceNames.windowsTask]);
		return;
	}
	if (currentPlatform() === 'linux') {
		run('systemctl', ['--user', 'start', serviceNames.systemdUnit]);
		return;
	}
	run('launchctl', [
		'kickstart',
		`${guiTarget()}/${serviceNames.launchdLabel}`,
	]);
}

export function stopService() {
	if (currentPlatform() === 'win32') {
		run('schtasks.exe', ['/End', '/TN', serviceNames.windowsTask], {
			quiet: true,
		});
		return;
	}
	if (currentPlatform() === 'linux') {
		run('systemctl', ['--user', 'stop', serviceNames.systemdUnit], {
			quiet: true,
		});
		return;
	}
	run('launchctl', ['bootout', `${guiTarget()}/${serviceNames.launchdLabel}`], {
		quiet: true,
	});
}

/** The command a reader should type when status reports the server down. */
export function restartCommand(platform: Platform = currentPlatform()): string {
	if (platform === 'win32') {
		return `schtasks /End /TN "${serviceNames.windowsTask}" && schtasks /Run /TN "${serviceNames.windowsTask}"`;
	}
	if (platform === 'linux') {
		return `systemctl --user restart ${serviceNames.systemdUnit}`;
	}
	return `launchctl kickstart -k gui/$UID/${serviceNames.launchdLabel}`;
}
