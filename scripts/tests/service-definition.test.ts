import { describe, expect, it } from 'vitest';
import {
	isAccessDenied,
	launchdPlist,
	serviceNames,
	systemdUnit,
	launcherExecutable,
	restartExitCode,
	windowsLauncherScript,
	windowsElevationMessage,
	windowsTaskXml,
	type ServiceCommand,
} from '../gizmo/service-definition';
import { restartCommand } from '../gizmo/service-platform';

const command: ServiceCommand = {
	exe: '/opt/node/bin/node',
	args: ['/app/node_modules/tsx/dist/cli.mjs', '/app/scripts/gizmo.ts', 'run'],
	cwd: '/app',
	env: { GIZMO_DATA_DIR: '/data/gizmo' },
	logFile: '/data/gizmo/logs/web.log',
};

describe('systemdUnit', () => {
	const unit = systemdUnit(command);

	it('restarts always, and keeps running without a session', () => {
		expect(unit).toContain('Restart=always');
		expect(unit).toContain('RestartSec=15');
		expect(unit).toContain('WantedBy=default.target');
	});

	it('runs the resolved node path with every argument quoted', () => {
		expect(unit).toContain(
			'ExecStart="/opt/node/bin/node" "/app/node_modules/tsx/dist/cli.mjs" "/app/scripts/gizmo.ts" "run"',
		);
	});

	it('carries the data directory', () => {
		expect(unit).toContain('Environment=GIZMO_DATA_DIR=/data/gizmo');
	});
});

describe('launchdPlist', () => {
	const plist = launchdPlist(command);

	it('keeps the agent alive and throttled', () => {
		expect(plist).toContain(`<string>${serviceNames.launchdLabel}</string>`);
		expect(plist).toMatch(/<key>KeepAlive<\/key>\s*\n\t<true\/>/);
		expect(plist).toMatch(
			/<key>ThrottleInterval<\/key>\s*\n\t<integer>15<\/integer>/,
		);
	});

	it('sends both streams to the web log', () => {
		expect(plist).toContain('<string>/data/gizmo/logs/web.log</string>');
	});

	it('omits the environment block when there is nothing to set', () => {
		expect(launchdPlist({ ...command, env: {} })).not.toContain(
			'EnvironmentVariables',
		);
	});
});

describe('windowsTaskXml', () => {
	const xml = windowsTaskXml(
		'C:\Users\a\.gizmo\app\startup.cmd',
		'C:\app',
		'GENGE\mchan',
	);

	it('starts at logon and restarts on failure', () => {
		expect(xml).toContain('<LogonTrigger>');
		expect(xml).toContain('<Interval>PT1M</Interval>');
		expect(xml).toContain('<Count>999</Count>');
		expect(xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
	});

	it('runs windowless as the installing user, so no console can close it', () => {
		expect(xml).toContain('<LogonType>S4U</LogonType>');
		expect(xml).toContain('<UserId>GENGE\mchan</UserId>');
		expect(xml).not.toContain('InteractiveToken');
	});

	it('never times the server out', () => {
		expect(xml).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
	});

	it('is UTF-16 CRLF, which is all schtasks accepts', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-16"?>')).toBe(
			true,
		);
		expect(xml).toContain('\r\n');
	});
});

describe('windowsLauncherScript', () => {
	it('sets the environment and runs from the app root', () => {
		const script = windowsLauncherScript({ ...command, cwd: 'C:\app' });
		expect(script).toContain('cd /d "C:\app"');
		expect(script).toContain('set "GIZMO_DATA_DIR=/data/gizmo"');
		expect(script).toContain(
			'"/opt/node/bin/node" "/app/node_modules/tsx/dist/cli.mjs"',
		);
	});

	// Task Scheduler never relaunches an action that exited, so without the
	// loop an update from the browser leaves the server down.
	it('starts the server again whenever it exits', () => {
		const lines = windowsLauncherScript(command).split('\r\n');
		const label = lines.indexOf(':run');
		expect(lines.slice(label + 1, label + 3)).toEqual([
			'cd /d "/app"',
			expect.stringMatching(/^"\/opt\/node\/bin\/node" /),
		]);
		expect(lines).toContain(
			`if %errorlevel% equ ${String(restartExitCode)} goto run`,
		);
		expect(lines.at(-2)).toBe('goto run');
		expect(lines.some((line) => line.startsWith('exit'))).toBe(false);
	});
});

describe('launcherExecutable', () => {
	it('reads the node path back from a launcher, old or new', () => {
		const old =
			'@echo off\r\nsetlocal\r\ncd /d "C:\\app"\r\nset "A=B"\r\n' +
			'"C:\\node\\node.exe" "C:\\app\\cli.mjs" "run"\r\nexit /b %errorlevel%\r\n';
		expect(launcherExecutable(old)).toBe('C:\\node\\node.exe');
		expect(launcherExecutable(windowsLauncherScript(command))).toBe(
			'/opt/node/bin/node',
		);
		expect(launcherExecutable('@echo off\r\n')).toBeNull();
	});
});

describe('restartCommand', () => {
	it('names the mechanism in use on each platform', () => {
		expect(restartCommand('win32')).toBe('gizmo service restart');
		expect(restartCommand('linux')).toContain(serviceNames.systemdUnit);
		expect(restartCommand('darwin')).toContain(serviceNames.launchdLabel);
	});
});

describe('windowsElevationMessage', () => {
	it('names the task and the console that can register it', () => {
		const message = windowsElevationMessage();
		expect(message).toContain(serviceNames.windowsTask);
		expect(message).toContain('Run as administrator');
		expect(message).toContain('work from a normal console');
	});

	it('claims elevation only for the failure elevation fixes', () => {
		expect(isAccessDenied('ERROR: Access is denied.')).toBe(true);
		expect(
			isAccessDenied('ERROR: The system cannot find the file specified.'),
		).toBe(false);
	});
});
