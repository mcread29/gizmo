import type { ProjectConfig, WorkspaceIntegration } from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { GlobalResourceStore } from '../resources/global-resource-settings';
import { ProjectConfigStore } from './project-config-store';
import { listGizmoCompatiblePiExtensions } from '../resources/pi-global-resources';

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
		const pi = await listGizmoCompatiblePiExtensions();
		const piById = new Map(pi.map((extension) => [extension.id, extension]));
		const piOverrides = new Map(
			(config.piExtensions ?? []).map(({ id, enabled }) => [id, enabled]),
		);
		const integrations = registeredExtensions()
			.filter(({ id }) =>
				piById.has(id)
					? piById.get(id)!.enabled &&
						(piOverrides.get(id) ?? overrides.get(id) ?? true)
					: (overrides.get(id) ?? !globallyDisabled.has(id)),
			)
			.map(({ id }) => ({ id, root: '.' }));
		// UI-only companions also need enablement ids, even without a server integration.
		for (const extension of pi) {
			if (
				extension.enabled &&
				(piOverrides.get(extension.id) ??
					overrides.get(extension.id) ??
					true) &&
				!integrations.some(({ id }) => id === extension.id)
			) {
				integrations.push({ id: extension.id, root: '.' });
			}
		}
		return { config, integrations };
	}
}
