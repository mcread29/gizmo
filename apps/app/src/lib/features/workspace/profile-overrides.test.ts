import { describe, expect, it } from 'vitest';
import type { WorkspaceProfile } from '@gizmo/protocol';
import {
	isTemporaryProfile,
	sameProfileValues,
	temporaryProfile,
} from './profile-overrides';

const builtin = {
	id: 'default',
	name: 'Default',
	source: 'builtin:default',
	base: null,
	extensions: [],
	tools: { mode: 'default' },
	prompt: { mode: 'pi-default' },
} satisfies WorkspaceProfile;

describe('temporary profile overrides', () => {
	it('creates an editable derived profile without changing the default', () => {
		const override = temporaryProfile(builtin, [builtin]);

		expect(override).toMatchObject({
			id: 'default-override',
			source: 'workspace:temporary',
			base: 'default',
		});
		expect(isTemporaryProfile(override)).toBe(true);
		expect(sameProfileValues(override, builtin)).toBe(true);
		expect(builtin.extensions).toEqual([]);
	});

	it('treats reordered values as unchanged but detects actual overrides', () => {
		const left: WorkspaceProfile = {
			...builtin,
			extensions: [
				{ id: 'svelte', root: '.' },
				{ id: 'git', root: '.' },
			],
			skills: [
				{ id: 'review', enabled: true },
				{ id: 'test', enabled: false },
			],
		};
		const reordered: WorkspaceProfile = {
			...left,
			extensions: [...left.extensions].reverse(),
			skills: [...left.skills!].reverse(),
		};

		expect(sameProfileValues(left, reordered)).toBe(true);
		reordered.tools = { mode: 'default-plus-extension' };
		expect(sameProfileValues(left, reordered)).toBe(false);
	});
});
