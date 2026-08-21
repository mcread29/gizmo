import type { ExtensionDescriptor } from '@unity-agent/protocol';

/**
 * An installed extension provider. Providers may use any runtime or transport;
 * Gizmo only receives versioned descriptors and opaque operation results.
 */
export interface ExtensionProvider {
	list(workspacePath: string, signal: AbortSignal): Promise<ExtensionDescriptor[]>;
	invoke(
		workspacePath: string,
		extensionId: string,
		operationId: string,
		input: unknown,
		signal: AbortSignal,
	): Promise<unknown>;
}

