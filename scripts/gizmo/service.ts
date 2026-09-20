import { readConfig, configFromEnvironment, type WebConfig } from './config';
import { isListening, probeHost, reportStatus } from './status';
import {
	installService,
	startService,
	stopService,
	uninstallService,
} from './service-platform';
import { webConfigFile } from './paths';

/** A restart is a stop and a start; no platform needs anything cleverer. */
export function restartService() {
	stopService();
	startService();
}

export async function effectiveConfig(): Promise<WebConfig> {
	return (await readConfig()) ?? configFromEnvironment();
}

const delay = (milliseconds: number) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * A restart takes up to two minutes on a machine with many extensions, so
 * the caller waits on the ports rather than reporting success at spawn time.
 */
export async function waitUntilHealthy(timeoutMilliseconds = 150_000) {
	const config = await effectiveConfig();
	const web = probeHost(config);
	const deadline = Date.now() + timeoutMilliseconds;
	process.stdout.write('Waiting for the server');
	while (Date.now() < deadline) {
		const [agent, app] = await Promise.all([
			isListening(config.agentPort, '127.0.0.1'),
			isListening(config.webPort, web),
		]);
		if (agent && app) {
			console.log('\nUp.');
			return true;
		}
		process.stdout.write('.');
		await delay(2_000);
	}
	console.log(
		'\nStill not listening. Check the log, then `gizmo service status`.',
	);
	process.exitCode = 1;
	return false;
}

const usage =
	'Usage: gizmo service <install|uninstall|start|stop|restart|status>';

export async function serviceCommand(argv: readonly string[]) {
	const verb = argv[0];
	if (verb === 'install') {
		if (!(await readConfig())) {
			console.log(
				`No ${webConfigFile()} yet; the service will fall back to environment\n` +
					'variables until you run `gizmo configure`.',
			);
		}
		for (const name of await installService())
			console.log(`Registered ${name}`);
		console.log('\nStart it with:\n  gizmo service start');
		return;
	}
	if (verb === 'uninstall') {
		for (const name of await uninstallService()) console.log(`Removed ${name}`);
		return;
	}
	if (verb === 'start') {
		startService();
		await waitUntilHealthy();
		return;
	}
	if (verb === 'stop') {
		stopService();
		console.log('Stopped.');
		return;
	}
	if (verb === 'restart') {
		restartService();
		await waitUntilHealthy();
		return;
	}
	if (verb === 'status') {
		await reportStatus(await effectiveConfig());
		return;
	}
	console.error(usage);
	process.exitCode = 2;
}
