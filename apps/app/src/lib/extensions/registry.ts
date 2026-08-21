import type { ExtensionDescriptor } from '@unity-agent/protocol';
import { unityExtension } from '@unity-agent/unity/web';
import type {
	ExtensionContext,
	ExtensionHostContext,
	WebExtensionDefinition,
	WebExtensionRuntime,
} from './types';

const definitions: readonly WebExtensionDefinition[] = [unityExtension];

export function activateProjectExtensions(
	descriptors: readonly ExtensionDescriptor[],
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
