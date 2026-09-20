import { connect } from 'node:net';
import { bindAddress, isTailnetAddress, type WebConfig } from './config';
import { currentPlatform, restartCommand } from './service-platform';

/** Whether something is listening, which is the only local status worth reporting. */
export function isListening(
	port: number,
	host = '127.0.0.1',
): Promise<boolean> {
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
 * Where the web port should be answering, given how it was told to bind.
 * `all` is probed on loopback: 0.0.0.0 is a bind address, not a destination.
 */
export function probeHost(config: WebConfig): string {
	if (config.bind === 'all') return '127.0.0.1';
	if (config.bind !== 'tailscale') return bindAddress(config.bind);
	const address = config.urls
		.map((url) => new URL(url).hostname)
		.find((host) => isTailnetAddress(host) && host.includes('.'));
	return address ?? '127.0.0.1';
}

async function probeUrl(url: string) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			redirect: 'manual',
		});
		return response.status < 500
			? `ok   ${url}`
			: `fail ${url}  HTTP ${String(response.status)}`;
	} catch (error) {
		return `fail ${url}  ${error instanceof Error ? error.message : String(error)}`;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Asks the ports and then the URLs. The supervisor is never consulted: a
 * lapsed certificate or a missing DNS record shows up here as an unreachable
 * URL rather than as a page that loads and never connects.
 */
export async function reportStatus(config: WebConfig): Promise<void> {
	const web = probeHost(config);
	const ports = [
		{ port: config.agentPort, host: '127.0.0.1', label: 'agent server' },
		{ port: config.webPort, host: web, label: 'web app' },
	];
	const results = await Promise.all(
		ports.map(async (entry) => ({
			...entry,
			up: await isListening(entry.port, entry.host),
		})),
	);
	for (const result of results) {
		console.log(
			`${result.up ? 'up  ' : 'down'} ${result.host}:${String(result.port)}  ${result.label}`,
		);
	}
	const healthy = results.every((result) => result.up);
	if (config.urls.length) {
		console.log('');
		for (const line of await Promise.all(config.urls.map(probeUrl))) {
			console.log(line);
		}
	}
	if (healthy) return;
	console.log(
		`\nNot fully up. Restart with:\n  ${restartCommand(currentPlatform())}`,
	);
	process.exitCode = 1;
}
