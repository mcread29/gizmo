import type { UnityExtensionDescriptor } from '@unity-agent/protocol';
import { consoleExtension } from './console/console-extension.svelte';
import type {
	ExtensionContext,
	ExtensionHostContext,
	WebExtensionDefinition,
	WebExtensionRuntime,
} from './types';

const definitions: readonly WebExtensionDefinition[] = [consoleExtension];

export function activateProjectExtensions(
	descriptors: readonly UnityExtensionDescriptor[],
	context: ExtensionHostContext,
): WebExtensionRuntime[] {
	return descriptors.flatMap((descriptor) => {
		const definition = definitions.find(({ id }) => id === descriptor.id);
		if (!definition || definition.apiVersion !== descriptor.apiVersion)
			return [];
		const scopedContext: ExtensionContext = {
			projectPath: context.projectPath,
			invoke: (operation, input) =>
				context.invoke(descriptor.id, operation, input),
		};
		return [definition.activate(descriptor, scopedContext)];
	});
}
