import { describe, expect, it } from 'vitest';
import {
	frontedDomains,
	localUrls,
	retargetPort,
	tailscaleUrls,
} from '../gizmo/configure';
import { parseTailnetNode } from '../gizmo/tailscale';

const node = { magicDns: 'genge.angler-musical.ts.net', ipv4: '100.105.88.93' };

describe('profiles', () => {
	it('adds both loopback spellings for --local', () => {
		expect(localUrls(4173)).toEqual([
			'http://localhost:4173',
			'http://127.0.0.1:4173',
		]);
	});

	it('adds the direct names for --tailscale', () => {
		expect(tailscaleUrls(node, 4173, false)).toEqual([
			'http://genge.angler-musical.ts.net:4173',
			'http://100.105.88.93:4173',
		]);
	});

	it('adds only the served https URL for --tailscale --serve', () => {
		expect(tailscaleUrls(node, 4173, true)).toEqual([
			'https://genge.angler-musical.ts.net',
		]);
	});

	it('survives a node with no IPv4 address', () => {
		expect(tailscaleUrls({ magicDns: 'a.ts.net' }, 4173, false)).toEqual([
			'http://a.ts.net:4173',
		]);
	});
});

describe('retargetPort', () => {
	it('moves URLs that pointed at the old web port and leaves the rest', () => {
		expect(
			retargetPort(
				[
					'http://localhost:4173',
					'https://gizmo.genge.init0.link',
					'http://a:8080',
				],
				4173,
				5000,
			),
		).toEqual([
			'http://localhost:5000',
			'https://gizmo.genge.init0.link',
			'http://a:8080',
		]);
	});
});

describe('parseTailnetNode', () => {
	it('strips the trailing dot and splits the two address families', () => {
		expect(
			parseTailnetNode(
				JSON.stringify({
					Self: {
						DNSName: 'genge.angler-musical.ts.net.',
						TailscaleIPs: ['100.105.88.93', 'fd7a:115c:a1e0::9901:585d'],
					},
				}),
			),
		).toEqual({
			magicDns: 'genge.angler-musical.ts.net',
			ipv4: '100.105.88.93',
			ipv6: 'fd7a:115c:a1e0::9901:585d',
		});
	});

	it('says what to fix when MagicDNS is off', () => {
		expect(() => parseTailnetNode(JSON.stringify({ Self: {} }))).toThrow(
			/MagicDNS/,
		);
	});
});

describe('frontedDomains', () => {
	it('names only the hosts something has to terminate TLS for', () => {
		expect(
			frontedDomains({
				agentPort: 8787,
				webPort: 4173,
				bind: 'all',
				urls: [
					'http://localhost:4173',
					'http://100.105.88.93:4173',
					'http://genge.angler-musical.ts.net:4173',
					'https://gizmo.genge.init0.link',
				],
			}),
		).toEqual(['gizmo.genge.init0.link']);
	});
});
