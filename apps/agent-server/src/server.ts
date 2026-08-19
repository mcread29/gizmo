import { createAgentWebSocketServer } from './websocket-server';

const host = process.env.UNITY_AGENT_HOST ?? '127.0.0.1';
const port = parsePort(process.env.UNITY_AGENT_PORT);
const allowedOrigins = process.env.UNITY_AGENT_ORIGINS?.split(',')
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
		throw new Error(`Invalid UNITY_AGENT_PORT: ${value}`);
	}
	return port;
}
