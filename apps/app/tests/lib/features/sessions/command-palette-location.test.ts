import { describe, expect, it } from 'vitest';
import { splitLocation } from '../../../../src/lib/features/sessions/command-palette/location';

describe('splitLocation', () => {
	it('filters within the last resolved directory', () => {
		expect(splitLocation('/projects/render', '/projects')).toEqual({
			root: '/projects',
			filter: 'render',
		});
	});

	it('descends after a path separator', () => {
		expect(
			splitLocation('/projects/RenderingPlayground/src', '/projects'),
		).toEqual({
			root: '/projects/RenderingPlayground',
			filter: 'src',
		});
	});

	it('supports Windows paths', () => {
		expect(splitLocation('C:\\repos\\gizmo\\apps', 'C:\\repos')).toEqual({
			root: 'C:\\repos\\gizmo',
			filter: 'apps',
		});
	});

	it('uses an absolute path when it is outside the resolved root', () => {
		expect(splitLocation('/tmp/new-project', '/projects')).toEqual({
			root: '/tmp',
			filter: 'new-project',
		});
	});
});
