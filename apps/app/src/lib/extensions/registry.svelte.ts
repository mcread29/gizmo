import type { ExtensionDescriptor } from '@gizmo/protocol';
import type {
	ExtensionContext,
	ExtensionHostContext,
	GizmoWebExtension,
	WebExtensionRuntime,
} from './types';

/** Gizmo ships no extensions; every web integration arrives at runtime. */
const builtin: readonly GizmoWebExtension[] = [];

/**
 * Reactive so that extensions loaded at runtime reach the UI whenever they
 * finish arriving, rather than the app having to block startup on them.
 */
const installed = $state<{ extensions: readonly GizmoWebExtension[] }>({
	extensions: builtin,
});

export const webExtensions = (): readonly GizmoWebExtension[] =>
	installed.extensions;

/**
 * Installs runtime-loaded web extensions, de-duplicated by registry id.
 */
export function registerWebExtensions(
	incoming: readonly GizmoWebExtension[],
): void {
	const byId = new Map(builtin.map((extension) => [extension.id, extension]));
	for (const extension of incoming) byId.set(extension.id, extension);
	installed.extensions = [...byId.values()];
}

export function extension(
	id: string | undefined,
): GizmoWebExtension | undefined {
	return webExtensions().find((candidate) => candidate.id === id);
}

/** Activates the live RPC-style operations a project's installed extensions expose. */
export function activateProjectExtensions(
	descriptors: readonly ExtensionDescriptor[],
	context: ExtensionHostContext,
): WebExtensionRuntime[] {
	return descriptors.flatMap((descriptor) => {
		const definition = webExtensions().find(({ id }) => id === descriptor.id);
		if (
			!definition?.activate ||
			definition.apiVersion !== descriptor.apiVersion
		)
			return [];
		const scopedContext: ExtensionContext = {
			projectPath: context.projectPath,
			invoke: (operation, input) =>
				context.invoke(descriptor.id, operation, input),
		};
		return [definition.activate(descriptor, scopedContext)];
	});
}
