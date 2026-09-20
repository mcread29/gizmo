import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { webConfigFile } from './paths';

/** Which interface Vite preview listens on. The agent server is always loopback. */
export type Bind = 'loopback' | 'tailscale' | 'all';

/**
 * `web.json`: the whole contract between Gizmo and whatever serves it. Hosts
 * and origins are derived from `urls`, so there is one list to get wrong
 * instead of two that can disagree.
 */
export interface WebConfig {
	agentPort: number;
	webPort: number;
	bind: Bind;
	urls: string[];
}

export const defaultPorts = { agentPort: 8787, webPort: 4173 } as const;

const bindValues = new Set<string>(['loopback', 'tailscale', 'all']);

export function emptyConfig(): WebConfig {
	return { ...defaultPorts, bind: 'loopback', urls: [] };
}

const unique = <T>(values: T[]) => [...new Set(values)];

const splitList = (value: string) =>
	value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);

/** A URL reduced to its origin, which is what both derived lists are made of. */
export function normaliseUrl(value: string): string {
	const url = new URL(value.trim());
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`Not an http(s) URL: ${value}`);
	}
	return url.origin;
}

function parsePort(value: unknown, fallback: number): number {
	const port = Number(value);
	return Number.isInteger(port) && port > 0 && port < 65_536 ? port : fallback;
}

/** Accepts a hand-edited file: unknown keys are dropped, bad values fall back. */
export function parseConfig(raw: unknown): WebConfig {
	const source = (raw ?? {}) as Partial<Record<keyof WebConfig, unknown>>;
	const urls = Array.isArray(source.urls) ? source.urls : [];
	return {
		agentPort: parsePort(source.agentPort, defaultPorts.agentPort),
		webPort: parsePort(source.webPort, defaultPorts.webPort),
		bind: bindValues.has(String(source.bind))
			? (source.bind as Bind)
			: 'loopback',
		urls: unique(
			urls
				.filter((url): url is string => typeof url === 'string')
				.map(normaliseUrl),
		),
	};
}

/** `null` when the instance has never been configured, which callers act on. */
export async function readConfig(
	file = webConfigFile(),
): Promise<WebConfig | null> {
	try {
		return parseConfig(JSON.parse(await readFile(file, 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw new Error(`${file} is not readable as JSON: ${String(error)}`);
	}
}

export async function writeConfig(config: WebConfig, file = webConfigFile()) {
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, `${JSON.stringify(config, null, '\t')}\n`, 'utf8');
}

/**
 * The pre-`web.json` shape: the environment table the live scheduled task
 * still passes. Reproduced exactly, so an instance that has not been
 * configured yet keeps the reachability it had before this CLI existed.
 */
export function configFromEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): WebConfig {
	const webPort = parsePort(env.GIZMO_WEB_PORT, defaultPorts.webPort);
	const hosts = splitList(env.GIZMO_WEB_HOSTS ?? 'localhost,127.0.0.1');
	const extra = splitList(env.GIZMO_WEB_ORIGINS ?? '');
	return {
		agentPort: parsePort(env.GIZMO_PORT, defaultPorts.agentPort),
		webPort,
		// `--host` with no address is what the pre-web.json server used.
		bind: 'all',
		urls: unique([
			...hosts.map((host) => `http://${host}:${webPort}`),
			...extra.map(normaliseUrl),
		]),
	};
}

/** Vite's `allowedHosts`: every hostname the page is served on. */
export function hostsOf(config: WebConfig): string[] {
	return unique(config.urls.map((url) => new URL(url).hostname));
}

/** The agent server's origin allowlist: every configured URL, verbatim. */
export function originsOf(config: WebConfig): string[] {
	return unique(config.urls.map(normaliseUrl));
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export const isLoopbackHost = (host: string) =>
	loopbackHosts.has(host.toLowerCase());

/** 100.64.0.0/10, the CGNAT range Tailscale hands out. */
export function isTailnetAddress(host: string): boolean {
	const octets = host.split('.').map(Number);
	if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
		return host.toLowerCase().startsWith('fd7a:115c:a1e0:');
	}
	return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export const isTailnetHost = (host: string) =>
	isTailnetAddress(host) || host.toLowerCase().endsWith('.ts.net');

function bindNeededFor(url: string, webPort: number): Bind {
	const parsed = new URL(url);
	const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
	if (isLoopbackHost(parsed.hostname)) return 'loopback';
	// A URL on some other port is terminated by a front (Caddy, `tailscale
	// serve`) that reaches Vite preview on 127.0.0.1.
	if (port !== webPort) return 'loopback';
	return isTailnetHost(parsed.hostname) ? 'tailscale' : 'all';
}

/**
 * The narrowest interface that still serves every configured URL. Binding the
 * tailnet address alone keeps the port off the LAN, but only works when
 * nothing needs 127.0.0.1 — a custom domain's TLS front does.
 */
export function bindFor(config: WebConfig): Bind {
	const needs = new Set(
		config.urls.map((url) => bindNeededFor(url, config.webPort)),
	);
	if (needs.has('all')) return 'all';
	if (needs.has('tailscale'))
		return needs.has('loopback') ? 'all' : 'tailscale';
	return 'loopback';
}

/** The address passed to `vite preview --host`. */
export function bindAddress(bind: Bind, tailnetAddress?: string): string {
	if (bind === 'all') return '0.0.0.0';
	if (bind === 'loopback') return '127.0.0.1';
	if (!tailnetAddress) {
		throw new Error(
			'bind is "tailscale" but no Tailscale IPv4 address was found. Is tailscaled running?',
		);
	}
	return tailnetAddress;
}
