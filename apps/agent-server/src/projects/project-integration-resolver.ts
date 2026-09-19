import type { ProjectConfig, WorkspaceIntegration } from '@gizmo/protocol';
import { extensionsForWorkspace } from '../extensions/registry';
import { GlobalResourceStore } from '../resources/global-resource-settings';
import { ProjectConfigStore } from './project-config-store';
import { listPiExtensions } from '../resources/pi-global-resources';

export interface ResolvedProjectIntegrations {
	config: ProjectConfig;
	integrations: WorkspaceIntegration[];
}

/** Resolves project overrides against the current global extension state. */
export class ProjectIntegrationResolver {
	constructor(
		private readonly configs: ProjectConfigStore,
		private readonly global: GlobalResourceStore,
	) {}

	async resolve(projectPath: string): Promise<ResolvedProjectIntegrations> {
		const config = await this.configs.read(projectPath);
		const overrides = new Map(
			(config.gizmoExtensions ?? []).map(({ id, enabled }) => [id, enabled]),
		);
		const globallyDisabled = new Set(
			(await this.global.read()).disabledGizmoExtensions,
		);
		const pi = await listPiExtensions();
		const piById = new Map(pi.map((extension) => [extension.id, extension]));
		const piOverrides = new Map(
			(config.piExtensions ?? []).map(({ id, enabled }) => [id, enabled]),
		);
		/*
		 * A project override is the last word, both ways. Reading the global
		 * flag first made it a gate instead: a workspace could turn an
		 * extension off, but a workspace asking for one that is globally off —
		 * a Unity project naming the Unity extension — was silently ignored.
		 */
		const enabledFor = (id: string) =>
			piById.has(id)
				? (piOverrides.get(id) ?? overrides.get(id) ?? piById.get(id)!.enabled)
				: (overrides.get(id) ?? !globallyDisabled.has(id));
		const integrations = extensionsForWorkspace(projectPath)
			.filter(({ id }) => enabledFor(id))
			.map(({ id }) => ({ id, root: '.' }));
		// UI-only companions also need enablement ids, even without a server integration.
		for (const extension of pi) {
			if (
				enabledFor(extension.id) &&
				!integrations.some(({ id }) => id === extension.id)
			) {
				integrations.push({ id: extension.id, root: '.' });
			}
		}
		return { config, integrations };
	}
}
