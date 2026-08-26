import type { WorkspaceProfile } from '@gizmo/protocol';

export const temporaryProfileSource = 'workspace:temporary';

export function isTemporaryProfile(profile: WorkspaceProfile | undefined) {
	return profile?.source === temporaryProfileSource;
}

export function sameProfileValues(
	left: WorkspaceProfile,
	right: WorkspaceProfile,
) {
	return (
		JSON.stringify(profileValues(left)) === JSON.stringify(profileValues(right))
	);
}

export function temporaryProfile(
	base: WorkspaceProfile,
	profiles: readonly WorkspaceProfile[],
) {
	return {
		...cloneProfile(base),
		id: uniqueTemporaryId(base.id, profiles),
		source: temporaryProfileSource,
		base: base.id,
	};
}

function profileValues(profile: WorkspaceProfile) {
	return {
		name: profile.name,
		extensions: [...profile.extensions]
			.map(({ id, root }) => ({ id, root }))
			.sort(byId),
		skills: [...(profile.skills ?? [])]
			.map(({ id, enabled }) => ({ id, enabled }))
			.sort(byId),
		tools: profile.tools?.mode ?? 'default',
		prompt: profile.prompt?.mode ?? 'pi-default',
	};
}

function uniqueTemporaryId(
	baseId: string,
	profiles: readonly WorkspaceProfile[],
) {
	const stem = `${baseId.slice(0, 54)}-override`;
	if (!profiles.some(({ id }) => id === stem)) return stem;
	for (let index = 2; ; index += 1) {
		const suffix = `-${index}`;
		const candidate = `${stem.slice(0, 64 - suffix.length)}${suffix}`;
		if (!profiles.some(({ id }) => id === candidate)) return candidate;
	}
}

function cloneProfile(profile: WorkspaceProfile): WorkspaceProfile {
	return {
		...profile,
		extensions: profile.extensions.map((extension) => ({ ...extension })),
		...(profile.skills
			? { skills: profile.skills.map((skill) => ({ ...skill })) }
			: {}),
	};
}

function byId(left: { id: string }, right: { id: string }) {
	return left.id.localeCompare(right.id);
}
