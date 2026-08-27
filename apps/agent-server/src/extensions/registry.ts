import { resolve } from 'node:path';
import type { WorkspaceIntegration } from '@gizmo/protocol';
import type {
	ActiveExtensions,
	ExtensionContext,
	GizmoServerExtension,
} from '@gizmo/extensions';
import { isPathWithin } from '../path-utils';

let extensions: readonly GizmoServerExtension[] = [];

/** Installs the global extension catalog available for manual activation. */
export function registerExtensions(
	loaded: readonly GizmoServerExtension[],
): void {
	extensions = loaded;
}

/** Every installed extension, whether or not it applies to any workspace. */
export function registeredExtensions(): readonly GizmoServerExtension[] {
	return extensions;
}

/**
 * Lists globally installed Gizmo extensions. Enablement is global by default
 * (installed means on) with per-workspace overrides; opening a workspace never
 * probes its contents.
 */
export function installedGizmoExtensions() {
	return registeredExtensions().map(({ id, name }) => ({
		id,
		name,
		root: '.',
	}));
}

export async function activateExtensions(
	context: ExtensionContext,
	integrations: readonly WorkspaceIntegration[] = [],
): Promise<ActiveExtensions> {
	if (!integrations.length) return { extensions: [], tools: [] };
	const active = integrations.map((integration) => {
		const extension = extensions.find(({ id }) => id === integration.id);
		if (!extension) throw new Error(`Unknown integration: ${integration.id}`);
		const workspacePath = resolve(context.workspacePath);
		const integrationPath = resolve(workspacePath, integration.root);
		if (!isPathWithin(workspacePath, integrationPath)) {
			throw new Error(
				`Integration root must be inside the workspace: ${integration.root}`,
			);
		}
		return { extension, integrationPath };
	});

	return {
		extensions: active.map(({ extension }) => extension),
		systemPrompt: [
			coreSystemPrompt,
			...active.map(({ extension, integrationPath }) =>
				extension.systemPrompt
					? `${extension.systemPrompt}\nIntegration root: ${integrationPath}`
					: undefined,
			),
		]
			.filter(Boolean)
			.join('\n\n'),
		tools: active.flatMap(
			({ extension, integrationPath }) =>
				extension.createTools?.({
					...context,
					workspacePath: integrationPath,
				}) ?? [],
		),
	};
}

const coreSystemPrompt = `You are an expert software development assistant operating inside Gizmo. You help users understand and modify the selected workspace.

Use the available tools to inspect the workspace before making assumptions. Keep changes focused, preserve existing conventions, and report verification results clearly.`;
