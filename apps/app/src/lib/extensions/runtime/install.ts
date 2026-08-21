import type { AgentClient } from '../../agent-client/AgentClient';
import { registerWebExtensions } from '../registry.svelte';
import { loadWebExtensions } from './load-web-extension';

/**
 * Fetches and installs runtime-loaded web extensions before the app mounts, so
 * every consumer of the registry sees the full set from the first render.
 *
 * Extension UI is a nice-to-have at startup: a server that is unreachable, or
 * too old to know the request, must not stop the app from opening.
 */
export async function installWebExtensions(
	client: Pick<AgentClient, 'listWebExtensionBundles'>,
): Promise<string[]> {
	if (!client.listWebExtensionBundles) return [];
	try {
		const { bundles, diagnostics } = await client.listWebExtensionBundles();
		const loaded = await loadWebExtensions(bundles);
		registerWebExtensions(loaded.extensions);
		return [...diagnostics, ...loaded.diagnostics];
	} catch (error) {
		return [
			`Could not load web extensions: ${
				error instanceof Error ? error.message : String(error)
			}`,
		];
	}
}
