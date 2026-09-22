/**
 * The three supervisors Gizmo registers with. Each one already restarts a
 * crashed process and starts it at login, which is the whole job, so the repo
 * ships no supervisor loop of its own.
 */
export interface ServiceCommand {
	/** Resolved absolute path to `node`; never a shim, so PATH cannot matter. */
	exe: string;
	args: string[];
	cwd: string;
	env: Record<string, string>;
	logFile: string;
}

/** The names each platform knows the service by. */
export const serviceNames = {
	systemdUnit: 'gizmo.service',
	launchdLabel: 'link.init0.gizmo',
	windowsTask: 'Gizmo Web',
} as const;

const quoteSystemd = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

export function systemdUnit(command: ServiceCommand): string {
	const environment = Object.entries(command.env).map(
		([key, value]) => `Environment=${key}=${value}`,
	);
	return [
		'[Unit]',
		'Description=Gizmo web server',
		'After=network-online.target',
		'',
		'[Service]',
		'Type=simple',
		`WorkingDirectory=${command.cwd}`,
		`ExecStart=${[command.exe, ...command.args].map(quoteSystemd).join(' ')}`,
		...environment,
		'Restart=always',
		'RestartSec=15',
		'',
		'[Install]',
		'WantedBy=default.target',
		'',
	].join('\n');
}

const escapeXml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');

export function launchdPlist(command: ServiceCommand): string {
	const arguments_ = [command.exe, ...command.args]
		.map((value) => `\t\t<string>${escapeXml(value)}</string>`)
		.join('\n');
	const environment = Object.entries(command.env)
		.map(
			([key, value]) =>
				`\t\t<key>${escapeXml(key)}</key>\n\t\t<string>${escapeXml(value)}</string>`,
		)
		.join('\n');
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
		'<plist version="1.0">',
		'<dict>',
		'\t<key>Label</key>',
		`\t<string>${serviceNames.launchdLabel}</string>`,
		'\t<key>ProgramArguments</key>',
		'\t<array>',
		arguments_,
		'\t</array>',
		'\t<key>WorkingDirectory</key>',
		`\t<string>${escapeXml(command.cwd)}</string>`,
		...(environment
			? [
					'\t<key>EnvironmentVariables</key>',
					'\t<dict>',
					environment,
					'\t</dict>',
				]
			: []),
		'\t<key>RunAtLoad</key>',
		'\t<true/>',
		'\t<key>KeepAlive</key>',
		'\t<true/>',
		'\t<key>ThrottleInterval</key>',
		'\t<integer>15</integer>',
		'\t<key>StandardOutPath</key>',
		`\t<string>${escapeXml(command.logFile)}</string>`,
		'\t<key>StandardErrorPath</key>',
		`\t<string>${escapeXml(command.logFile)}</string>`,
		'</dict>',
		'</plist>',
		'',
	].join('\n');
}

/**
 * `schtasks /Create` cannot express restart-on-failure, so the task is
 * registered from XML instead of flags. That setting only retries a launch
 * that failed; restarting a server that exited is the launcher's job.
 *
 * `S4U` is what keeps the server out of the way. An `InteractiveToken` task
 * runs its action on the desktop, so a batch file gets a console window that
 * pops up at login and kills the server the moment anyone closes it. S4U runs
 * the same command as the same user with no window and no stored password.
 *
 * `LeastPrivilege` is deliberate too: the server binds high ports and writes
 * only inside the user's own home, so an elevated task would just create
 * administrator-owned files in `~/.gizmo`.
 */
export function windowsTaskXml(
	launcher: string,
	cwd: string,
	userId: string,
): string {
	return [
		'<?xml version="1.0" encoding="UTF-16"?>',
		'<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
		'  <RegistrationInfo>',
		'    <Description>Gizmo web server</Description>',
		'  </RegistrationInfo>',
		'  <Triggers>',
		'    <LogonTrigger>',
		'      <Enabled>true</Enabled>',
		'    </LogonTrigger>',
		'  </Triggers>',
		'  <Principals>',
		'    <Principal id="Author">',
		`      <UserId>${escapeXml(userId)}</UserId>`,
		'      <LogonType>S4U</LogonType>',
		'      <RunLevel>LeastPrivilege</RunLevel>',
		'    </Principal>',
		'  </Principals>',
		'  <Settings>',
		'    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
		'    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
		'    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
		'    <AllowHardTerminate>true</AllowHardTerminate>',
		'    <StartWhenAvailable>true</StartWhenAvailable>',
		'    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
		'    <IdleSettings>',
		'      <StopOnIdleEnd>false</StopOnIdleEnd>',
		'      <RestartOnIdle>false</RestartOnIdle>',
		'    </IdleSettings>',
		'    <AllowStartOnDemand>true</AllowStartOnDemand>',
		'    <Enabled>true</Enabled>',
		'    <Hidden>false</Hidden>',
		'    <RunOnlyIfIdle>false</RunOnlyIfIdle>',
		'    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>',
		'    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>',
		'    <WakeToRun>false</WakeToRun>',
		'    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
		'    <Priority>7</Priority>',
		'    <RestartOnFailure>',
		'      <Interval>PT1M</Interval>',
		'      <Count>999</Count>',
		'    </RestartOnFailure>',
		'  </Settings>',
		'  <Actions Context="Author">',
		'    <Exec>',
		`      <Command>${escapeXml(launcher)}</Command>`,
		`      <WorkingDirectory>${escapeXml(cwd)}</WorkingDirectory>`,
		'    </Exec>',
		'  </Actions>',
		'</Task>',
		'',
	].join('\r\n');
}

/**
 * Windows lets an ordinary console query, run and end a task, but creating or
 * deleting one in the root task folder needs an elevated token. `schtasks`
 * reports that as a bare "Access is denied", which reads like a bug rather
 * than a missing privilege, so the CLI says what to do instead.
 */
export function windowsElevationMessage(): string {
	return [
		`Windows will not let an ordinary console add or remove the "${serviceNames.windowsTask}"`,
		'scheduled task. Start PowerShell with "Run as administrator" and run the',
		'same command again.',
		'',
		'Only `service install` and `service uninstall` need that. `start`, `stop`,',
		'`restart` and `status` work from a normal console.',
	].join('\n');
}

/** True for the one `schtasks` failure that an elevated console would fix. */
export const isAccessDenied = (output: string) =>
	/access is denied/i.test(output);

/** The exit code with which the server asks to be started again at once. */
export const restartExitCode = 75;

/**
 * The launcher the scheduled task runs. It exists so the machine-local
 * environment lives in a file the user can read rather than inside the task
 * definition, where a wrong value is invisible.
 *
 * It is also the supervisor. Task Scheduler's RestartOnFailure covers only
 * a task that could not be launched; an action that exits, with any code,
 * just ends the task. So the loop is what `Restart=always` is to systemd: a
 * browser-started update exits with `restartExitCode` and comes straight
 * back up, anything else after the same 15 s pause. `service stop` ends
 * this `cmd.exe` first, so a stopped server stays stopped.
 *
 * The `cd` is inside the loop because the working directory is a handle on
 * whatever `current` pointed at when it was taken: kept, it would pin the
 * old release, which Windows then cannot delete.
 */
export function windowsLauncherScript(command: ServiceCommand): string {
	const environment = Object.entries(command.env).map(
		([key, value]) => `set "${key}=${value}"`,
	);
	const line = [command.exe, ...command.args]
		.map((value) => `"${value}"`)
		.join(' ');
	return [
		'@echo off',
		'setlocal',
		...environment,
		':run',
		`cd /d "${command.cwd}"`,
		line,
		`if %errorlevel% equ ${String(restartExitCode)} goto run`,
		// `timeout` refuses to run without a console, which an S4U task lacks.
		'ping -n 16 127.0.0.1 >nul',
		'goto run',
		'',
	].join('\r\n');
}

/** The `node` an existing launcher runs: its one line that starts quoted. */
export function launcherExecutable(script: string): string | null {
	return /^"([^"]+)"/m.exec(script)?.[1] ?? null;
}
