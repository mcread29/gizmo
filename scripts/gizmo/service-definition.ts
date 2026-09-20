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
 * registered from XML instead of flags.
 */
export function windowsTaskXml(launcher: string, cwd: string): string {
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
		'      <LogonType>InteractiveToken</LogonType>',
		'      <RunLevel>HighestAvailable</RunLevel>',
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
 * The launcher the scheduled task runs. It exists so the machine-local
 * environment lives in a file the user can read rather than inside the task
 * definition, where a wrong value is invisible.
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
		`cd /d "${command.cwd}"`,
		...environment,
		line,
		'',
	].join('\r\n');
}
