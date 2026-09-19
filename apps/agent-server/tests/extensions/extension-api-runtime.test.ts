import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { expect, it } from 'vitest';
import { ensureExtensionApiResolution } from '../../src/extensions/extension-api-runtime';

it('supplies the host API to a separate loader outside either checkout', async () => {
	const root = await mkdtemp(join(tmpdir(), 'gizmo-api-runtime-'));
	try {
		await writeFile(
			join(root, 'index.ts'),
			`
			import { defineExtension, gizmoView } from '@gizmo/extension-api';
			export const gizmoExtension = defineExtension({ id: 'standalone', name: 'Standalone' });
			export default () => gizmoView({ title: 'Standalone', blocks: [] });
		`,
		);
		ensureExtensionApiResolution();
		// No alias: this models Pi's independent jiti instance.
		const loaded = await createJiti(import.meta.url, {
			moduleCache: false,
		}).import<{
			gizmoExtension: { id: string };
			default: () => unknown;
		}>(join(root, 'index.ts'));
		expect(loaded.gizmoExtension.id).toBe('standalone');
		expect(loaded.default()).toBeDefined();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
