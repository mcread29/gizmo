import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export interface TailnetNode {
	/** MagicDNS name with the trailing dot stripped. */
	magicDns: string;
	ipv4?: string;
	ipv6?: string;
}

const windowsFallback = 'C:\Program Files\Tailscale\tailscale.exe';

/** `tailscale` is not on PATH in a Windows service session by default. */
export function tailscaleBinary(): string {
	if (process.platform === 'win32' && existsSync(windowsFallback)) {
		return windowsFallback;
	}
	return 'tailscale';
}

export function runTailscale(args: string[]) {
	const result = spawnSync(tailscaleBinary(), args, {
		encoding: 'utf8',
		windowsHide: true,
	});
	if (result.error || result.status !== 0) {
		const detail = result.error
			? result.error.message
			: (result.stderr || '').trim() || `exit ${String(result.status)}`;
		throw new Error(`tailscale ${args.join(' ')} failed: ${detail}`);
	}
	return result.stdout;
}

/** Pulls this node's own names out of `tailscale status --json`. */
export function parseTailnetNode(statusJson: string): TailnetNode {
	const parsed = JSON.parse(statusJson) as {
		Self?: { DNSName?: string; TailscaleIPs?: string[] };
		TailscaleIPs?: string[];
	};
	const self = parsed.Self ?? {};
	const addresses = self.TailscaleIPs ?? parsed.TailscaleIPs ?? [];
	const magicDns = (self.DNSName ?? '').replace(/\.$/, '');
	if (!magicDns) {
		throw new Error(
			'Tailscale reported no MagicDNS name for this node. Enable MagicDNS in the tailnet, then re-run.',
		);
	}
	return {
		magicDns,
		ipv4: addresses.find((address) => address.includes('.')),
		ipv6: addresses.find((address) => address.includes(':')),
	};
}

export function tailnetNode(): TailnetNode {
	return parseTailnetNode(runTailscale(['status', '--json']));
}

/** Puts a real certificate in front of the web port, on the tailnet only. */
export function startTailscaleServe(webPort: number) {
	runTailscale(['serve', '--bg', String(webPort)]);
}

export function stopTailscaleServe() {
	runTailscale(['serve', '--bg', 'off']);
}
