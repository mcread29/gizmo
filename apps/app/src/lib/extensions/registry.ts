import type { ExtensionDescriptor } from '@gizmo/protocol';
import { unityWebExtension } from '@gizmo/unity/web';
import type {
	ExtensionContext,
	ExtensionHostContext,
	GizmoWebExtension,
	WebExtensionRuntime,
} from './types';

export const extensions: readonly GizmoWebExtension[] = [
	unityWebExtension,
	{ id: 'svelte' },
];

export function extension(id: string | undefined): GizmoWebExtension | undefined {
	return extensions.find((candidate) => candidate.id === id);
}

/** Activates the live RPC-style operations a project's installed extensions expose. */
export function activateProjectExtensions(
	descriptors: readonly ExtensionDescriptor[],
	context: ExtensionHostContext,
): WebExtensionRuntime[] {
	return descriptors.flatMap((descriptor) => {
		const definition = extensions.find(({ id }) => id === descriptor.id);
		if (!definition?.activate || definition.apiVersion !== descriptor.apiVersion)
			return [];
		const scopedContext: ExtensionContext = {
			projectPath: context.projectPath,
			invoke: (operation, input) =>
				context.invoke(descriptor.id, operation, input),
		};
		return [definition.activate(descriptor, scopedContext)];
	});
}
