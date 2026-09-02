import type { SkillResource } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	collectionRoot,
	directoryLabel,
	groupByDirectory,
	matchingSkills,
} from '../../../../src/lib/features/settings/skill-groups';

describe('collectionRoot', () => {
	it('files an editable skill under personal skills', () => {
		expect(collectionRoot(skill({ editable: true }))).toBe('personal-skills');
	});

	it("attributes an extension's skill to the extension, not its parent", () => {
		const root = collectionRoot(
			skill({
				path: 'C:\\gizmo\\extensions\\unity\\skills\\build\\SKILL.md',
				source: 'C:\\gizmo\\extensions',
			}),
		);

		expect(root).toBe('C:/gizmo/extensions/unity/skills');
	});

	it('falls back to the source directory, normalized', () => {
		expect(
			collectionRoot(
				skill({ path: 'C:\\skills\\review.md', source: 'C:\\skills' }),
			),
		).toBe('C:/skills');
	});
});

describe('directoryLabel', () => {
	it('names a collection after its owner rather than the skills folder', () => {
		expect(directoryLabel('C:/gizmo/extensions/unity/skills')).toBe('unity');
	});

	it('uses the leaf when it is not a skills folder', () => {
		expect(directoryLabel('C:/gizmo/bundled')).toBe('bundled');
	});

	it('has a friendly name for personal skills', () => {
		expect(directoryLabel('personal-skills')).toBe('Personal skills');
	});
});

describe('matchingSkills', () => {
	const skills = [
		skill({ id: 'b', name: 'Build', enabledGlobally: false }),
		skill({ id: 'a', name: 'Audit', description: 'review the diff' }),
	];

	it('sorts by name by default', () => {
		expect(
			matchingSkills(skills, '', 'all', 'name').map((s) => s.name),
		).toEqual(['Audit', 'Build']);
	});

	it('puts enabled skills first when sorting by status', () => {
		expect(
			matchingSkills(skills, '', 'all', 'status').map((s) => s.name),
		).toEqual(['Audit', 'Build']);
	});

	it('filters to enabled and disabled', () => {
		expect(matchingSkills(skills, '', 'on', 'name')).toHaveLength(1);
		expect(matchingSkills(skills, '', 'off', 'name')).toHaveLength(1);
	});

	it('searches descriptions as well as names', () => {
		expect(
			matchingSkills(skills, 'review the', 'all', 'name').map((s) => s.name),
		).toEqual(['Audit']);
	});
});

describe('groupByDirectory', () => {
	it('groups skills under a labelled collection, ordered by label', () => {
		const groups = groupByDirectory([
			skill({ id: '1', source: 'C:\\zeta' }),
			skill({ id: '2', editable: true }),
			skill({ id: '3', source: 'C:\\zeta' }),
		]);

		expect(groups.map((group) => group.label)).toEqual([
			'Personal skills',
			'zeta',
		]);
		expect(groups.at(-1)?.skills).toHaveLength(2);
	});
});

function skill(overrides: Partial<SkillResource> = {}): SkillResource {
	return {
		id: 'skill',
		name: 'Skill',
		description: '',
		path: 'C:\\skills\\skill.md',
		source: 'C:\\skills',
		editable: false,
		enabledGlobally: true,
		...overrides,
	} as SkillResource;
}
