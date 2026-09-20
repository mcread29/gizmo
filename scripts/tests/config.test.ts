import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	bindAddress,
	bindFor,
	configFromEnvironment,
	emptyConfig,
	hostsOf,
	isTailnetAddress,
	normaliseUrl,
	originsOf,
	parseConfig,
	readConfig,
	writeConfig,
	type WebConfig,
} from '../gizmo/config';

const directories: string[] = [];
async function temporaryFile(name = 'web.json') {
	const directory = await mkdtemp(join(tmpdir(), 'gizmo-config-'));
	directories.push(directory);
	return join(directory, name);
}

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

const config = (overrides: Partial<WebConfig> = {}): WebConfig => ({
	...emptyConfig(),
	...overrides,
});

describe('normaliseUrl', () => {
	it('reduces a URL to its origin', () => {
		expect(normaliseUrl('http://localhost:4173/some/path?x=1')).toBe(
			'http://localhost:4173',
		);
	});

	it('rejects a scheme a browser would never use here', () => {
		expect(() => normaliseUrl('ws://localhost:4173')).toThrow(/http\(s\)/);
	});
});

describe('parseConfig', () => {
	it('falls back rather than trusting a hand-edited file', () => {
		expect(
			parseConfig({
				agentPort: 'nonsense',
				webPort: 99_999,
				bind: 'sideways',
				urls: [7],
			}),
		).toEqual(emptyConfig());
	});

	it('keeps ports, bind and de-duplicated urls', () => {
		expect(
			parseConfig({
				agentPort: 9000,
				webPort: 5000,
				bind: 'tailscale',
				urls: ['http://a:5000/', 'http://a:5000'],
			}),
		).toEqual({
			agentPort: 9000,
			webPort: 5000,
			bind: 'tailscale',
			urls: ['http://a:5000'],
		});
	});
});

describe('the file', () => {
	it('round-trips and reports an absent file as null', async () => {
		const file = await temporaryFile();
		expect(await readConfig(file)).toBeNull();
		const written = config({ bind: 'all', urls: ['http://localhost:4173'] });
		await writeConfig(written, file);
		expect(await readConfig(file)).toEqual(written);
		expect(await readFile(file, 'utf8')).toMatch(/\n$/);
	});

	it('names the unreadable file rather than starting blank', async () => {
		const file = await temporaryFile('broken.json');
		await writeFile(file, '{ not json', 'utf8');
		await expect(readConfig(file)).rejects.toThrow(
			/broken\.json is not readable/,
		);
	});
});

describe('configFromEnvironment', () => {
	it('reproduces the pre-web.json environment table', () => {
		expect(
			configFromEnvironment({
				GIZMO_PORT: '8787',
				GIZMO_WEB_PORT: '4173',
				GIZMO_WEB_HOSTS:
					'localhost,127.0.0.1,100.105.88.93,genge.angler-musical.ts.net',
				GIZMO_WEB_ORIGINS: 'https://gizmo.genge.init0.link',
			}),
		).toEqual({
			agentPort: 8787,
			webPort: 4173,
			bind: 'all',
			urls: [
				'http://localhost:4173',
				'http://127.0.0.1:4173',
				'http://100.105.88.93:4173',
				'http://genge.angler-musical.ts.net:4173',
				'https://gizmo.genge.init0.link',
			],
		});
	});

	it('defaults to loopback on the standard ports', () => {
		expect(configFromEnvironment({})).toEqual({
			agentPort: 8787,
			webPort: 4173,
			bind: 'all',
			urls: ['http://localhost:4173', 'http://127.0.0.1:4173'],
		});
	});
});

describe('derived lists', () => {
	const live = config({
		urls: [
			'http://localhost:4173',
			'http://100.105.88.93:4173',
			'https://gizmo.genge.init0.link',
		],
	});

	it('gives Vite one entry per hostname', () => {
		expect(hostsOf(live)).toEqual([
			'localhost',
			'100.105.88.93',
			'gizmo.genge.init0.link',
		]);
	});

	it('gives the agent server every URL verbatim', () => {
		expect(originsOf(live)).toEqual(live.urls);
	});
});

describe('isTailnetAddress', () => {
	it.each([
		'100.64.0.1',
		'100.105.88.93',
		'100.127.255.255',
		'fd7a:115c:a1e0::1',
	])('accepts %s', (address) => {
		expect(isTailnetAddress(address)).toBe(true);
	});

	it.each(['100.63.255.255', '100.128.0.1', '10.0.0.129', '76.86.4.68'])(
		'rejects %s',
		(address) => {
			expect(isTailnetAddress(address)).toBe(false);
		},
	);
});

describe('bindFor', () => {
	it('binds loopback for a local-only instance', () => {
		expect(
			bindFor(
				config({ urls: ['http://localhost:4173', 'http://127.0.0.1:4173'] }),
			),
		).toBe('loopback');
	});

	it('binds the tailnet address when only the tailnet reaches it directly', () => {
		expect(
			bindFor(
				config({
					urls: [
						'http://100.105.88.93:4173',
						'http://genge.angler-musical.ts.net:4173',
					],
				}),
			),
		).toBe('tailscale');
	});

	it('widens to all when loopback is needed too', () => {
		expect(
			bindFor(
				config({
					urls: ['http://localhost:4173', 'http://100.105.88.93:4173'],
				}),
			),
		).toBe('all');
	});

	it('stays on loopback behind a TLS front, which proxies from 127.0.0.1', () => {
		expect(bindFor(config({ urls: ['https://gizmo.genge.init0.link'] }))).toBe(
			'loopback',
		);
	});

	it('widens to all for a LAN address on the web port', () => {
		expect(bindFor(config({ urls: ['http://192.168.1.5:4173'] }))).toBe('all');
	});

	it('binds loopback when nothing is configured', () => {
		expect(bindFor(emptyConfig())).toBe('loopback');
	});
});

describe('bindAddress', () => {
	it('maps each bind to an interface', () => {
		expect(bindAddress('loopback')).toBe('127.0.0.1');
		expect(bindAddress('all')).toBe('0.0.0.0');
		expect(bindAddress('tailscale', '100.105.88.93')).toBe('100.105.88.93');
	});

	it('refuses to silently widen when the tailnet address is unknown', () => {
		expect(() => bindAddress('tailscale')).toThrow(/tailscaled/);
	});
});
