import { describe, expect, it } from 'vitest';
import { caddyfile, publicExposureWarning } from '../gizmo/caddy';
import {
	compareVersions,
	parseChecksums,
	tarExecutable,
	tarballName,
} from '../gizmo/release-download';
import { pnpmExecutable } from '../gizmo/pnpm';
import {
	excludedFromRelease,
	releaseNotes,
	selectReleaseFiles,
} from '../gizmo/pack';

describe('caddyfile', () => {
	it('binds the tailnet address and proxies to the web port', () => {
		expect(
			caddyfile({
				hostname: 'gizmo.genge.init0.link',
				webPort: 4173,
				bindAddress: '100.105.88.93',
			}),
		).toBe(
			[
				'gizmo.genge.init0.link {',
				'\tbind 100.105.88.93',
				'\treverse_proxy 127.0.0.1:4173',
				'\ttls {',
				'\t\tdns cloudflare {env.CLOUDFLARE_API_TOKEN}',
				'\t}',
				'}',
				'',
			].join('\n'),
		);
	});

	it('leaves out the bind when the address is unknown', () => {
		expect(caddyfile({ hostname: 'a.example', webPort: 4173 })).not.toContain(
			'bind',
		);
	});
});

describe('publicExposureWarning', () => {
	it('says what resolved and why it is refused', () => {
		const warning = publicExposureWarning('a.example', {
			addresses: ['104.21.0.1'],
			tailnetOnly: false,
		});
		expect(warning).toContain('104.21.0.1');
		expect(warning).toContain('--public');
	});

	it('names the missing record when nothing resolved', () => {
		expect(
			publicExposureWarning('a.example', { addresses: [], tailnetOnly: false }),
		).toContain('no A/AAAA record');
	});
});

describe('compareVersions', () => {
	it('orders releases oldest first', () => {
		expect(
			['v0.2.0', 'v0.1.9', 'v0.10.0', 'v0.1.10'].sort(compareVersions),
		).toEqual(['v0.1.9', 'v0.1.10', 'v0.2.0', 'v0.10.0']);
	});
});

describe('parseChecksums', () => {
	it('reads the format sha256sum writes', () => {
		const digest = 'a'.repeat(64);
		expect(
			parseChecksums(
				`${digest}  gizmo-v0.1.0.tar.gz\n\n${'b'.repeat(64)} *other\n`,
			),
		).toEqual(
			new Map([
				[tarballName('v0.1.0'), digest],
				['other', 'b'.repeat(64)],
			]),
		);
	});

	it('ignores a line that is not a checksum', () => {
		expect(parseChecksums('not a checksum line').size).toBe(0);
	});
});

describe('selectReleaseFiles', () => {
	const tracked = [
		'package.json',
		'apps/app/src/main.ts',
		'extensions/registry',
		'research/notes.md',
		'skills-ref/a/SKILL.md',
		'.github/workflows/release.yml',
	];

	it('ships tracked sources plus the built bundle and the manifest', () => {
		expect(selectReleaseFiles(tracked, ['apps/app/dist/index.html'])).toEqual([
			'RELEASE.json',
			'apps/app/dist/index.html',
			'apps/app/src/main.ts',
			'package.json',
		]);
	});

	it('leaves out the submodule and the repository furniture', () => {
		const files = selectReleaseFiles(tracked, []);
		for (const path of excludedFromRelease) {
			expect(files.some((file) => file.startsWith(path))).toBe(false);
		}
	});

	it('takes what git prints, blank trailing line and all', () => {
		expect(selectReleaseFiles(['package.json', ''], [])).toEqual([
			'RELEASE.json',
			'package.json',
		]);
	});

	it('normalises Windows separators, so tar reads one kind of path', () => {
		expect(selectReleaseFiles([], ['apps\\app\\dist\\index.html'])).toContain(
			'apps/app/dist/index.html',
		);
	});
});

describe('releaseNotes', () => {
	const worklog =
		'# Work log\n\n## 2026-09-20 — v0.1.0\n\n- Shipped.\n\n## 2026-09-19 — Earlier\n\n- Older.\n';

	it('prefers the section naming the version', () => {
		expect(releaseNotes(worklog, 'v0.1.0')).toBe(
			'## 2026-09-20 — v0.1.0\n\n- Shipped.\n',
		);
	});

	it('falls back to the newest section', () => {
		expect(releaseNotes(worklog, 'v9.9.9')).toBe(
			'## 2026-09-20 — v0.1.0\n\n- Shipped.\n',
		);
	});

	it('falls back to the version when the log has no sections', () => {
		expect(releaseNotes('# Work log\n', 'v0.1.0')).toBe('v0.1.0');
	});
});

describe('tarExecutable', () => {
	it('uses the System32 copy on Windows so GNU tar never sees a drive letter', () => {
		const env = { SystemRoot: 'C:\\Windows' };
		expect(tarExecutable('win32', env, () => true)).toMatch(
			/System32.tar\.exe$/,
		);
		expect(tarExecutable('win32', env, () => false)).toBe('tar');
	});

	it('leaves other platforms on PATH lookup', () => {
		expect(tarExecutable('linux', {})).toBe('tar');
		expect(tarExecutable('darwin', {})).toBe('tar');
	});
});

describe('pnpmExecutable', () => {
	it('prefers the corepack shim beside node', () => {
		expect(
			pnpmExecutable('/opt/node/bin/node', 'linux', (path) =>
				path.endsWith('/bin/pnpm'),
			),
		).toBe('/opt/node/bin/pnpm');
		expect(
			pnpmExecutable('C:\\nodejs\\node.exe', 'win32', (path) =>
				path.endsWith('pnpm.cmd'),
			),
		).toMatch(/pnpm\.cmd$/);
	});

	it('falls back to PATH when there is no shim', () => {
		expect(pnpmExecutable('/opt/node/bin/node', 'linux', () => false)).toBe(
			'pnpm',
		);
	});
});
