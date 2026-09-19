import { connect } from 'node:net';

/**
 * The scheduled task that owns the process. Named here rather than in a doc
 * because this is the string a reader needs to type next, and the one place
 * they will already be looking when the CLI tells them not to hand-start.
 */
export const supervisorTask = 'Gizmo Web';

const restartCommand = `schtasks /End /TN "${supervisorTask}" && schtasks /Run /TN "${supervisorTask}"`;

/**
 * Refuses a verb that would race the supervisor.
 *
 * These verbs used to be how Gizmo ran. genge-services took the process over
 * and they were left behind, still looking authoritative while tracking a
 * state file nothing writes any more -- which is how a healthy server came to
 * be reported as down, and how hand-starting one came to hold the ports the
 * supervisor then could not bind. Refusing is the point: there is no safe
 * meaning left for them to have.
 */
export function refuseSupervisedVerb(verb: string): void {
	console.error(
		[
			`"${verb}" is not how Gizmo Web runs any more.`,
			'',
			`The "${supervisorTask}" scheduled task owns the process (genge-services`,
			'runs scripts/web-server.ts for you, and re-runs it if it exits).',
			'Starting one by hand holds ports 8787 and 4173 and puts the',
			'supervisor into a restart loop.',
			'',
			'To restart it:',
			`  ${restartCommand}`,
			'',
			'See docs/web-server.md.',
		].join('\n'),
	);
	process.exitCode = 2;
}

/** Whether something is listening, which is the only status worth reporting. */
export function isListening(port: number, host = '127.0.0.1'): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ port, host });
		const settle = (value: boolean) => {
			socket.destroy();
			resolve(value);
		};
		socket.setTimeout(1_500);
		socket.once('connect', () => settle(true));
		socket.once('timeout', () => settle(false));
		socket.once('error', () => settle(false));
	});
}

/**
 * Reports what is actually bound. This asks the ports rather than a state
 * file on purpose: the supervisor keeps no state file here, so anything that
 * consults one is answering about a mechanism that no longer runs.
 */
export async function reportSupervisedStatus(
	ports: readonly { port: number; label: string }[],
): Promise<void> {
	const results = await Promise.all(
		ports.map(async (entry) => ({
			...entry,
			up: await isListening(entry.port),
		})),
	);
	for (const result of results) {
		console.log(`${result.up ? 'up  ' : 'down'} ${result.port}  ${result.label}`);
	}
	if (results.every((result) => result.up)) {
		console.log(`\nSupervised by the "${supervisorTask}" scheduled task.`);
		return;
	}
	console.log(`\nNot fully up. Restart with:\n  ${restartCommand}`);
	process.exitCode = 1;
}
