import { relative, resolve } from 'node:path';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { WorkspaceIntegration, WorkspaceProfile } from '@gizmo/protocol';
import type {
	ActiveExtensions,
	ExtensionContext,
	GizmoServerExtension,
} from '@gizmo/extensions';
import { isPathWithin } from '../path-utils';

let extensions: readonly GizmoServerExtension[] = [];

/** Installs the extensions available to detect/activate against a workspace. */
export function registerExtensions(
	loaded: readonly GizmoServerExtension[],
): void {
	extensions = loaded;
}

/** Every installed extension, whether or not it applies to any workspace. */
export function registeredExtensions(): readonly GizmoServerExtension[] {
	return extensions;
}

/** Tools every session receives, regardless of detected integrations. */
export function defaultExtensionTools(
	context: ExtensionContext,
): ToolDefinition[] {
	return extensions.flatMap(
		(extension) => extension.defaultTools?.(context) ?? [],
	);
}

export async function detectExtensions(workspacePath: string) {
	const detectable = extensions.filter((extension) => extension.detect);
	const detected = await Promise.all(
		detectable.map(async (extension) => {
			const roots = extension.detectRoots
				? await extension.detectRoots(workspacePath)
				: (await extension.detect!(workspacePath))
					? [workspacePath]
					: [];
			const root = roots[0];
			return {
				id: extension.id,
				name: extension.name,
				detected: Boolean(root),
				root: root ? relative(workspacePath, root) || '.' : '.',
			};
		}),
	);
	return {
		domains: detected,
		profiles: [
			defaultProfile(),
			...detected
				.filter(({ detected }) => detected)
				.map(({ id, root }) => extensionFor(id).profile!(root)),
		],
	};
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

export function defaultProfile(): WorkspaceProfile {
	return {
		id: 'default',
		name: 'Default',
		source: 'builtin:default',
		base: null,
		extensions: [],
		tools: { mode: 'default' },
		prompt: { mode: 'pi-default' },
	};
}

function extensionFor(id: string): GizmoServerExtension {
	const extension = extensions.find((candidate) => candidate.id === id);
	if (!extension) throw new Error(`Unknown extension: ${id}`);
	return extension;
}
