import type { SkillResource } from '@gizmo/protocol';

export type SkillFilter = 'all' | 'on' | 'off';
export type SkillSort = 'name' | 'status' | 'directory';

export interface SkillDirectoryGroup {
	source: string;
	label: string;
	skills: SkillResource[];
}

/**
 * Filtering, ordering and grouping for the skills library. Kept beside the
 * component rather than inside it, the way every other feature here already
 * splits its list logic out — which also makes the path parsing below testable
 * without mounting a settings screen.
 */

/** The directory a skill is collected under, used for grouping and sorting. */
export function collectionRoot(skill: SkillResource): string {
	if (skill.editable) return 'personal-skills';
	const parts = skill.path.replaceAll('\\', '/').split('/');
	const extensionIndex = parts.lastIndexOf('extensions');
	// An extension's skills belong to the extension, not to the shared root
	// every extension happens to live under.
	if (
		extensionIndex >= 0 &&
		parts[extensionIndex + 1] &&
		parts[extensionIndex + 2]?.toLowerCase() === 'skills'
	) {
		return parts.slice(0, extensionIndex + 3).join('/');
	}
	return skill.source.replaceAll('\\', '/');
}

/** The name to show for a collection: the owner, not the "skills" folder. */
export function directoryLabel(source: string): string {
	if (source === 'personal-skills') return 'Personal skills';
	const parts = source.split('/').filter(Boolean);
	const leaf = parts.at(-1);
	return leaf?.toLowerCase() === 'skills'
		? (parts.at(-2) ?? leaf)
		: (leaf ?? source);
}

export function matchingSkills(
	skills: readonly SkillResource[],
	query: string,
	filter: SkillFilter,
	sort: SkillSort,
): SkillResource[] {
	const term = query.trim().toLowerCase();
	return skills
		.filter((skill) => {
			if (filter === 'on' && !skill.enabledGlobally) return false;
			if (filter === 'off' && skill.enabledGlobally) return false;
			return (
				!term ||
				skill.name.toLowerCase().includes(term) ||
				skill.description.toLowerCase().includes(term)
			);
		})
		.sort((a, b) => {
			if (sort === 'status') {
				return (
					Number(b.enabledGlobally) - Number(a.enabledGlobally) ||
					a.name.localeCompare(b.name)
				);
			}
			if (sort === 'directory') {
				return (
					collectionRoot(a).localeCompare(collectionRoot(b)) ||
					a.name.localeCompare(b.name)
				);
			}
			return a.name.localeCompare(b.name);
		});
}

export function groupByDirectory(
	skills: readonly SkillResource[],
): SkillDirectoryGroup[] {
	const groups = new Map<string, SkillResource[]>();
	for (const skill of skills) {
		const source = collectionRoot(skill);
		const existing = groups.get(source);
		if (existing) existing.push(skill);
		else groups.set(source, [skill]);
	}
	return [...groups]
		.map(([source, grouped]) => ({
			source,
			label: directoryLabel(source),
			skills: grouped,
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}
