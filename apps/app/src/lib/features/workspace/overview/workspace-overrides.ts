import type {
	DigestScope,
	PiExtensionResource,
	ProjectConfig,
	SkillResource,
	ToolPolicy,
} from '@gizmo/protocol';
import type { WorkspaceTab } from '../../../router.svelte';

/**
 * A workspace is read as its departures from the global settings, so Overview
 * answers "what is different here?" before the tabs answer "what could be".
 * Derived here rather than in the card so the rule for what counts as a
 * departure is testable without mounting a screen.
 */
export interface WorkspaceOverride {
	/** Stable identity for keyed rendering; unique across kinds. */
	key: string;
	kind: 'skill' | 'extension' | 'tools' | 'digest-model' | 'digest-auto';
	/** The overridden item, absent for the single built-in tools row. */
	id?: string;
	name: string;
	/** What this workspace does. */
	here: string;
	/** What it would do if the override were cleared. */
	globally: string;
	/** The tab that edits it. */
	tab: WorkspaceTab;
}

export interface WorkspaceOverrideInput {
	skills: readonly SkillResource[];
	extensions: readonly PiExtensionResource[];
	/** Domains left over from the retired profile system, if any remain. */
	gizmoExtensions?: readonly { id: string; name: string; enabled: boolean }[];
	config: ProjectConfig | undefined;
	toolPolicy: ToolPolicy | undefined;
	/** How this workspace digests its journal, and what it would inherit. */
	memory?: DigestScope | undefined;
}

export function workspaceOverrides({
	skills,
	extensions,
	gizmoExtensions = [],
	config,
	toolPolicy,
	memory,
}: WorkspaceOverrideInput): WorkspaceOverride[] {
	const rows: WorkspaceOverride[] = [];

	for (const skill of skills) {
		if (skill.override === undefined) continue;
		rows.push({
			key: `skill:${skill.id}`,
			kind: 'skill',
			id: skill.id,
			name: skill.name,
			here: skill.override ? 'On here' : 'Off here',
			globally: skill.enabledGlobally ? 'on globally' : 'off globally',
			tab: 'skills',
		});
	}

	// A Pi extension override may still be recorded under the older
	// `gizmoExtensions` key, the way the extension rows themselves read it.
	const seen = new Set<string>();
	for (const { id, enabled } of [
		...(config?.piExtensions ?? []),
		...(config?.gizmoExtensions ?? []),
	]) {
		if (seen.has(id)) continue;
		seen.add(id);
		const extension = extensions.find((candidate) => candidate.id === id);
		const legacy = gizmoExtensions.find((candidate) => candidate.id === id);
		const globallyOn = extension?.enabled ?? legacy?.enabled ?? true;
		rows.push({
			key: `extension:${id}`,
			kind: 'extension',
			id,
			name: extension?.name ?? legacy?.name ?? id,
			here: enabled ? 'On here' : 'Off here',
			globally: globallyOn ? 'on globally' : 'off globally',
			tab: 'extensions',
		});
	}

	/*
	 * The two digest settings are overridden one at a time, so they are two
	 * rows rather than one "Memory" row: reverting the model must not also
	 * revert automatic digesting.
	 */
	if (memory?.override && 'model' in memory.override) {
		rows.push({
			key: 'digest-model',
			kind: 'digest-model',
			name: 'Digest model',
			here: memory.override.model
				? `${memory.override.model.provider} · ${memory.override.model.id} here`
				: 'Off here',
			globally: memory.defaults.model
				? `${memory.defaults.model.provider} · ${memory.defaults.model.id} globally`
				: 'off globally',
			tab: 'memory',
		});
	}
	if (memory?.override?.auto !== undefined) {
		rows.push({
			key: 'digest-auto',
			kind: 'digest-auto',
			name: 'Automatic digesting',
			here: memory.override.auto ? 'On here' : 'Off here',
			globally: memory.defaults.auto ? 'on globally' : 'off globally',
			tab: 'memory',
		});
	}

	if (toolPolicy?.project) {
		rows.push({
			key: 'tools',
			kind: 'tools',
			name: 'Built-in tools',
			here: `${toolPolicy.project.length} allowed here`,
			globally: toolPolicy.global
				? `${toolPolicy.global.length} allowed globally`
				: 'Pi defaults globally',
			tab: 'overview',
		});
	}

	return rows;
}
