import type { ExtensionDescriptor } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import { ExtensionHostService } from '../../src/extensions/extension-host-service';
import type { GizmoServerExtension } from '@gizmo/extensions';

const descriptor: ExtensionDescriptor = {
	id: 'com.example.notes',
	name: 'Notes',
	version: '1.0.0',
	apiVersion: 1,
	capabilities: ['notes.read'],
	operations: [
		{ id: 'read', mutates: false, requiresConfirmation: false },
		{ id: 'delete', mutates: true, requiresConfirmation: true },
	],
};

describe('ExtensionHostService', () => {
	it('validates declared operations without knowing the provider runtime', async () => {
		const calls: string[] = [];
		const provider: GizmoServerExtension = {
			id: 'notes',
			name: 'Notes',
			list: async () => [descriptor],
			invoke: async (_workspace, _extension, operation) => {
				calls.push(operation);
				return { ok: true };
			},
		};
		const host = new ExtensionHostService([provider]);

		await expect(
			host.invoke('/workspace', descriptor.id, 'delete'),
		).rejects.toThrow('requires confirmation');
		await expect(
			host.invoke('/workspace', descriptor.id, 'read'),
		).resolves.toEqual({ ok: true });
		expect(calls).toEqual(['read']);
	});
});
