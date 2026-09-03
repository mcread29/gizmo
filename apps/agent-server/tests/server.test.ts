import { describe, expect, it } from 'vitest';
import { configuredOrigins } from '../src/server-config';

describe('server origin configuration', () => {
	it('allows the configured dev host without a second environment variable', () => {
		expect(configuredOrigins({ GIZMO_DEV_HOST: '100.68.130.1' })).toContain(
			'http://100.68.130.1:5173',
		);
	});

	it('keeps an explicit origin allowlist authoritative', () => {
		expect(
			configuredOrigins({
				GIZMO_DEV_HOST: '100.68.130.1',
				GIZMO_ORIGINS: 'https://gizmo.example',
			}),
		).toEqual(['https://gizmo.example']);
	});
});
