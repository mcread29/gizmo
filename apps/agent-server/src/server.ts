import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAgentWebSocketServer } from './transport/websocket-server';

await restoreDesktopEnvironment();

const host =
	process.env.GIZMO_HOST ?? process.env.UNITY_AGENT_HOST ?? '127.0.0.1';
const port = parsePort(process.env.GIZMO_PORT ?? process.env.UNITY_AGENT_PORT);
const allowedOrigins = (
	process.env.GIZMO_ORIGINS ?? process.env.UNITY_AGENT_ORIGINS
)
	?.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);
const agentServer = await createAgentWebSocketServer({
	host,
	port,
	...(allowedOrigins?.length ? { allowedOrigins } : {}),
});

console.log(`Gizmo server listening on ws://${host}:${port}/agent`);

let closing = false;
async function close() {
	if (closing) return;
	closing = true;
	await agentServer.close();
}

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

function parsePort(value: string | undefined): number {
	if (value === undefined) return 8787;
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid GIZMO_PORT: ${value}`);
	}
	return port;
}

async function restoreDesktopEnvironment(): Promise<void> {
	if (process.platform !== 'linux' || process.env.DISPLAY) return;
	try {
		const { stdout } = await promisify(execFile)('systemctl', [
			'--user',
			'show-environment',
		]);
		const desktopVariables = new Set([
			'DISPLAY',
			'WAYLAND_DISPLAY',
			'XAUTHORITY',
		]);
		for (const line of stdout.split('\n')) {
			const separator = line.indexOf('=');
			const key = line.slice(0, separator);
			if (separator > 0 && desktopVariables.has(key) && !process.env[key]) {
				process.env[key] = line.slice(separator + 1);
			}
		}
	} catch {
		// Headless Linux sessions legitimately have no user desktop environment.
	}
}
