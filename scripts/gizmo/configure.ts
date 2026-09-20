import { writeFile } from 'node:fs/promises';
import { numberValue, parseArgs, singleValue, type ParsedArgs } from './args';
import {
	bindFor,
	emptyConfig,
	hostsOf,
	isLoopbackHost,
	isTailnetHost,
	normaliseUrl,
	readConfig,
	writeConfig,
	type Bind,
	type WebConfig,
} from './config';
import {
	caddyfile,
	lookupPublicAddresses,
	publicExposureWarning,
} from './caddy';
import {
	startTailscaleServe,
	tailnetNode,
	type TailnetNode,
} from './tailscale';
import { webConfigFile } from './paths';

const valueFlags = new Set([
	'url',
	'caddyfile',
	'agent-port',
	'web-port',
	'bind',
]);
const binds = new Set<string>(['loopback', 'tailscale', 'all']);

export function localUrls(webPort: number): string[] {
	return [
		`http://localhost:${String(webPort)}`,
		`http://127.0.0.1:${String(webPort)}`,
	];
}

/**
 * Without `--serve` the browser talks to Vite preview directly, so the raw
 * names go in. With it, `tailscale serve` terminates TLS on 443 and the only
 * URL worth allowing is the https one.
 */
export function tailscaleUrls(
	node: TailnetNode,
	webPort: number,
	serve: boolean,
): string[] {
	if (serve) return [`https://${node.magicDns}`];
	const port = String(webPort);
	return [
		`http://${node.magicDns}:${port}`,
		...(node.ipv4 ? [`http://${node.ipv4}:${port}`] : []),
	];
}

/** Keeps URLs pointing at the web port when the web port moves. */
export function retargetPort(
	urls: string[],
	from: number,
	to: number,
): string[] {
	return urls.map((url) => {
		const parsed = new URL(url);
		if (Number(parsed.port) !== from) return url;
		parsed.port = String(to);
		return parsed.origin;
	});
}

function addUrls(config: WebConfig, urls: string[]): WebConfig {
	return {
		...config,
		urls: [...new Set([...config.urls, ...urls.map(normaliseUrl)])],
	};
}

async function checkPublicExposure(hostname: string, allowPublic: boolean) {
	const answer = await lookupPublicAddresses(hostname);
	if (answer.tailnetOnly) return;
	const warning = publicExposureWarning(hostname, answer);
	if (!allowPublic) throw new Error(warning);
	console.warn(`WARNING: ${warning}\n`);
}

async function emitCaddyfile(
	args: ParsedArgs,
	hostname: string,
	config: WebConfig,
	bindAddress: string | undefined,
) {
	const rendered = caddyfile({
		hostname,
		webPort: config.webPort,
		bindAddress,
	});
	const target = singleValue(args, 'caddyfile');
	if (target) {
		await writeFile(target, rendered, 'utf8');
		console.log(`Wrote ${target}`);
		return;
	}
	console.log(
		`\nPut this in front of Gizmo (Caddy, or the equivalent elsewhere):\n`,
	);
	console.log(rendered);
}

function reportDomainSetup(hostname: string, node: TailnetNode | undefined) {
	console.log(
		`Point ${hostname} at this node with a DNS-only (not proxied) A record for` +
			`\n  ${node?.ipv4 ?? 'this node’s Tailscale IPv4 address'}` +
			(node?.ipv6
				? `\nand optionally an AAAA record for\n  ${node.ipv6}`
				: '') +
			'\nRun `gizmo configure --tailscale` too, so the raw address and MagicDNS' +
			'\nname still work if the domain is ever unreachable.\n',
	);
}

/**
 * The hosts something else terminates TLS for. Loopback and tailnet names
 * reach Vite preview directly, so only these need a front in front of them.
 */
export function frontedDomains(config: WebConfig): string[] {
	return hostsOf(config).filter(
		(host) => !isLoopbackHost(host) && !isTailnetHost(host),
	);
}

function describe(config: WebConfig) {
	console.log(JSON.stringify(config, null, '\t'));
}

export async function configureCommand(argv: readonly string[]) {
	const args = parseArgs(argv, valueFlags);
	const existing = await readConfig();
	if (args.flags.has('show')) {
		if (!existing) {
			console.log(
				`No ${webConfigFile()} yet. Run \`gizmo configure\` to create one.`,
			);
			return;
		}
		describe(existing);
		return;
	}

	let config = args.flags.has('reset')
		? emptyConfig()
		: (existing ?? emptyConfig());
	const previousWebPort = config.webPort;
	config.agentPort = numberValue(args, 'agent-port') ?? config.agentPort;
	config.webPort = numberValue(args, 'web-port') ?? config.webPort;
	if (config.webPort !== previousWebPort) {
		config.urls = retargetPort(config.urls, previousWebPort, config.webPort);
	}

	const urlFlags = args.values.get('url') ?? [];
	const wantsTailscale = args.flags.has('tailscale') || args.flags.has('serve');
	const wantsLocal =
		args.flags.has('local') ||
		(!wantsTailscale && urlFlags.length === 0 && !args.flags.has('reset'));

	if (wantsLocal) config = addUrls(config, localUrls(config.webPort));

	let node: TailnetNode | undefined;
	if (wantsTailscale) {
		node = tailnetNode();
		config = addUrls(
			config,
			tailscaleUrls(node, config.webPort, args.flags.has('serve')),
		);
	}

	for (const raw of urlFlags) {
		const hostname = new URL(normaliseUrl(raw)).hostname;
		await checkPublicExposure(hostname, args.flags.has('public'));
		config = addUrls(config, [raw]);
	}

	const requested = singleValue(args, 'bind');
	if (requested !== undefined && !binds.has(requested)) {
		throw new Error('--bind takes loopback, tailscale or all.');
	}
	config.bind = (requested as Bind | undefined) ?? bindFor(config);

	await writeConfig(config);
	console.log(`Wrote ${webConfigFile()}`);
	describe(config);

	if (args.flags.has('serve')) {
		startTailscaleServe(config.webPort);
		console.log(
			`\ntailscale serve is fronting port ${String(config.webPort)}.`,
		);
	}
	for (const raw of urlFlags) {
		const hostname = new URL(normaliseUrl(raw)).hostname;
		console.log('');
		reportDomainSetup(hostname, node ?? safeNode());
		await emitCaddyfile(args, hostname, config, (node ?? safeNode())?.ipv4);
	}
	// `--caddyfile` on its own is how you get the front's config back for a
	// domain configured earlier, without re-running the DNS check.
	if (urlFlags.length === 0 && args.values.has('caddyfile')) {
		const domains = frontedDomains(config);
		if (domains.length === 0) {
			console.log(
				'No domain in web.json needs a front. Add one with --url first.',
			);
		}
		for (const hostname of domains) {
			await emitCaddyfile(args, hostname, config, safeNode()?.ipv4);
		}
	}
	console.log('\nweb.json changed. Apply it with:\n  gizmo service restart');
}

/** Configuration should still write when tailscaled is not running. */
function safeNode(): TailnetNode | undefined {
	try {
		return tailnetNode();
	} catch {
		return undefined;
	}
}
