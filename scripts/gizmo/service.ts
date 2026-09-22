import { readConfig, configFromEnvironment, type WebConfig } from './config';
import { isListening, probeHost, reportStatus } from './status';
import {
	installService,
	startService,
	stopService,
	uninstallService,
} from './service-platform';
import { appRoot, serviceRoot, webConfigFile } from './paths';
import { currentVersion } from './releases-store';
import { runningVersion, treeVersion } from './running';

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
 * What a restart should bring up, decided the way `service install` decides
 * what to register: a release install runs whatever `current` names, and a
 * checkout runs itself, even when a `current` link left over from an earlier
 * release install points somewhere else.
 */
export async function expectedVersion(root = appRoot): Promise<string> {
	if (serviceRoot(root) === root) return treeVersion(root);
	return (await currentVersion()) ?? 'source';
}

/**
 * A restart takes up to two minutes on a machine with many extensions, so
 * the caller waits on the ports rather than reporting success at spawn time.
 *
 * An open port is not enough on its own. A stop that missed leaves the old
 * server holding both ports, the new one exits because it cannot bind, and
 * every probe here answers immediately — which is how an update could report
 * `Up.` and go on serving the release it had just replaced. So the server
 * that answers must also say it is `expect`.
 */
export async function waitUntilHealthy(
	expect?: string,
	timeoutMilliseconds = 150_000,
) {
	const config = await effectiveConfig();
	const web = probeHost(config);
	const deadline = Date.now() + timeoutMilliseconds;
	let portsUp = false;
	process.stdout.write('Waiting for the server');
	while (Date.now() < deadline) {
		const [agent, app] = await Promise.all([
			isListening(config.agentPort, '127.0.0.1'),
			isListening(config.webPort, web),
		]);
		portsUp = agent && app;
		if (portsUp && (!expect || runningVersion() === expect)) {
			console.log('\nUp.');
			return true;
		}
		process.stdout.write('.');
		await delay(2_000);
	}
	reportUnhealthy(portsUp, expect);
	process.exitCode = 1;
	return false;
}

function reportUnhealthy(portsUp: boolean, expect?: string) {
	const live = runningVersion();
	if (portsUp && expect) {
		console.log(
			`\nThe ports answer, but ${live ?? 'the process holding them'} is ` +
				`serving, not ${expect}: the restart did not replace it.\n` +
				'Run `gizmo service stop`, check `gizmo status`, then ' +
				'`gizmo service start`.',
		);
		return;
	}
	console.log(
		'\nStill not listening. Check the log, then `gizmo service status`.',
	);
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
		await waitUntilHealthy(await expectedVersion());
		return;
	}
	if (verb === 'stop') {
		stopService();
		console.log('Stopped.');
		return;
	}
	if (verb === 'restart') {
		restartService();
		await waitUntilHealthy(await expectedVersion());
		return;
	}
	if (verb === 'status') {
		await reportStatus(await effectiveConfig());
		return;
	}
	console.error(usage);
	process.exitCode = 2;
}
