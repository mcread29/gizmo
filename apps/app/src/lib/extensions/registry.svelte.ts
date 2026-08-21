import type { ExtensionDescriptor } from '@gizmo/protocol';
import { unityWebExtension } from '@gizmo/unity/web';
import type {
	ExtensionContext,
	ExtensionHostContext,
	GizmoWebExtension,
	WebExtensionRuntime,
} from './types';

/**
 * Extensions the app ships with. First-party ones stay here because the app
 * bundles them anyway; anything installed later arrives through
 * `registerWebExtensions` instead.
 */
const builtin: readonly GizmoWebExtension[] = [
	unityWebExtension,
	{ id: 'svelte' },
];

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
 * Installs runtime-loaded web extensions. A built-in of the same id wins, so a
 * loaded bundle can never displace one the app ships.
 */
export function registerWebExtensions(
	incoming: readonly GizmoWebExtension[],
): void {
	const known = new Set(builtin.map(({ id }) => id));
	installed.extensions = [
		...builtin,
		...incoming.filter(({ id }) => !known.has(id)),
	];
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
