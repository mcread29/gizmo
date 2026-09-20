import { Resolver } from 'node:dns/promises';
import { isTailnetAddress } from './config';

export interface CaddySite {
	hostname: string;
	webPort: number;
	/** The Tailscale address Caddy listens on, so the LAN never sees port 443. */
	bindAddress?: string;
}

/**
 * Gizmo does not obtain certificates or bind 443 itself: both need privileges
 * a user-level service should not have and differ on every platform. This is
 * the config for the front that does, with Caddy recommended because it is
 * one binary everywhere and renews on its own.
 */
export function caddyfile(site: CaddySite): string {
	return [
		`${site.hostname} {`,
		...(site.bindAddress ? [`\tbind ${site.bindAddress}`] : []),
		`\treverse_proxy 127.0.0.1:${String(site.webPort)}`,
		'\ttls {',
		'\t\tdns cloudflare {env.CLOUDFLARE_API_TOKEN}',
		'\t}',
		'}',
		'',
	].join('\n');
}

export interface DnsAnswer {
	addresses: string[];
	/** True when every answer is a tailnet address, so only the tailnet can reach it. */
	tailnetOnly: boolean;
}

/** Cloudflare's resolver, so a local split-DNS answer cannot mask a public record. */
export async function lookupPublicAddresses(
	hostname: string,
): Promise<DnsAnswer> {
	const resolver = new Resolver({ timeout: 5_000, tries: 2 });
	resolver.setServers(['1.1.1.1', '1.0.0.1']);
	const answers = await Promise.all([
		resolver.resolve4(hostname).catch(() => [] as string[]),
		resolver.resolve6(hostname).catch(() => [] as string[]),
	]);
	const addresses = answers.flat();
	return {
		addresses,
		tailnetOnly:
			addresses.length > 0 &&
			addresses.every((address) => isTailnetAddress(address)),
	};
}

export function publicExposureWarning(
	hostname: string,
	answer: DnsAnswer,
): string {
	const seen = answer.addresses.length
		? answer.addresses.join(', ')
		: 'no A/AAAA record';
	return (
		`${hostname} resolves to ${seen}, which is not a Tailscale address.\n` +
		'Neither Vite preview nor the agent server authenticates anyone, so a\n' +
		'proxied Cloudflare record or a public tunnel would put an unauthenticated\n' +
		"Gizmo on the internet. Use a DNS-only A record for this node's 100.x\n" +
		'address, or pass --public if that is genuinely what you want.'
	);
}
