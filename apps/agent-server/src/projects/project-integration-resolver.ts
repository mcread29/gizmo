import type { ProjectConfig, WorkspaceIntegration } from '@gizmo/protocol';
import { registeredExtensions } from '../extensions/registry';
import { GlobalResourceStore } from '../resources/global-resource-settings';
import { ProjectConfigStore } from './project-config-store';

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
		const integrations = registeredExtensions()
			.filter(({ id }) => overrides.get(id) ?? !globallyDisabled.has(id))
			.map(({ id }) => ({ id, root: '.' }));
		return { config, integrations };
	}
}
