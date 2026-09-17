import type { DisplayEnvelope } from '@gizmo/protocol';
import { extension } from './registry.svelte';

/** Unknown or incomplete extension catalogs fall back to the normal result. */
export function hasDisplayCatalog(display: DisplayEnvelope): boolean {
	if (!('catalog' in display) || !display.catalog) return true;
	const slash = display.catalog.indexOf('/');
	const registry = extension(display.catalog.slice(0, slash))
		?.displayCatalogs?.[display.catalog.slice(slash + 1)];
	return Boolean(
		registry &&
		Object.values(display.spec.elements).every(({ type }) =>
			Object.hasOwn(registry, type),
		),
	);
}
