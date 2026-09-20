import { describe, expect, it } from 'vitest';
import {
	isAccessDenied,
	launchdPlist,
	serviceNames,
	systemdUnit,
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
});

describe('restartCommand', () => {
	it('names the mechanism in use on each platform', () => {
		expect(restartCommand('win32')).toContain(serviceNames.windowsTask);
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
