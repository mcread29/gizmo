import type { WebExtensionBundle } from '@gizmo/protocol';
import type { GizmoWebExtension } from '../types';
import { publishHostModules } from './host-modules';

/**
 * Loads a web extension the app's own build never saw.
 *
 * Vite — like any bundler — resolves import specifiers by static analysis at
 * build time, so a plugin installed later cannot be reached by an ordinary
 * import. The way around it is a genuine runtime `import()` of a URL the
 * bundler cannot analyse: the JS engine resolves that itself. The bundle
 * arrives as source over the existing agent connection and is turned into a
 * blob URL here, so no extra HTTP server is needed.
 *
 * This requires `script-src ... blob:` in the Tauri CSP; see tauri.conf.json.
 */

/**
 * Loads every bundle, keeping the ones that work. One broken plugin must not
 * take the app's whole extension surface down with it.
 */
export async function loadWebExtensions(
	bundles: readonly WebExtensionBundle[],
): Promise<{ extensions: GizmoWebExtension[]; diagnostics: string[] }> {
	const extensions: GizmoWebExtension[] = [];
	const diagnostics: string[] = [];
	const results = await Promise.all(
		bundles.map(async (bundle) => {
			try {
				const { extension, issues } = validate(bundle.id, await load(bundle));
				return {
					extension,
					diagnostics: issues.map(
						(issue) => `Web extension "${bundle.id}": ${issue}`,
					),
				};
			} catch (error) {
				return {
					diagnostics: [
						`Failed to load web extension "${bundle.id}": ${
							error instanceof Error ? error.message : String(error)
						}`,
					],
				};
			}
		}),
	);
	for (const result of results) {
		if (result.extension) extensions.push(result.extension);
		diagnostics.push(...result.diagnostics);
	}
	return { extensions, diagnostics };
}

async function load(bundle: WebExtensionBundle): Promise<unknown> {
	publishHostModules();
	const url = URL.createObjectURL(
		new Blob([bundle.code], { type: 'text/javascript' }),
	);
	try {
		return await import(/* @vite-ignore */ url);
	} finally {
		// The module stays live once evaluated; the URL is only needed to fetch it.
		URL.revokeObjectURL(url);
	}
}

/** A field expected to be a function — a Svelte component or a callback. */
function isFunction(value: unknown): value is (...args: never[]) => unknown {
	return typeof value === 'function';
}

/**
 * Every field beyond `id` comes from code Gizmo does not control. Rather than
 * trust the whole object, each optional field is checked against the shape
 * `GizmoWebExtension` promises and dropped individually if it does not match
 * — so a plugin with one malformed field loses just that capability instead
 * of surfacing a raw `TypeError` deep inside a Svelte render, or the plugin
 * failing to load at all over one bad field.
 */
function validate(
	id: string,
	module: unknown,
): { extension: GizmoWebExtension; issues: string[] } {
	const exported =
		module !== null &&
		typeof module === 'object' &&
		'gizmoWebExtension' in module
			? (module as { gizmoWebExtension: unknown }).gizmoWebExtension
			: undefined;
	if (exported === null || typeof exported !== 'object') {
		throw new Error('bundle does not export a gizmoWebExtension object');
	}
	const candidate = exported as Record<string, unknown>;
	if (typeof candidate.id !== 'string' || !candidate.id) {
		throw new Error('gizmoWebExtension has no id');
	}
	// The id is the identity the server dispatches on; a bundle claiming a
	// different one would let an extension impersonate another.
	if (candidate.id !== id) {
		throw new Error(
			`bundle declares id "${candidate.id}" but was served as "${id}"`,
		);
	}

	const issues: string[] = [];
	const extension: { id: string } & Record<string, unknown> = {
		id: candidate.id,
	};

	function keep(
		field: string,
		check: (value: unknown) => boolean,
		expected: string,
	): void {
		const value = candidate[field];
		if (value === undefined) return;
		if (!check(value)) {
			issues.push(`"${field}" is not ${expected}; ignoring it`);
			return;
		}
		extension[field] = value;
	}

	keep('dialog', isFunction, 'a component');
	keep('settings', isFunction, 'a component');
	keep('createView', isFunction, 'a function');
	keep('hasProjectStatus', (v) => typeof v === 'boolean', 'a boolean');
	keep('apiVersion', (v) => typeof v === 'number', 'a number');
	keep('activate', isFunction, 'a function');
	keep('inspectorTabs', isFunction, 'a function');
	keep('commands', isFunction, 'a function');
	keep('statusBar', isFunction, 'a function');
	keep(
		'labels',
		(v) =>
			v !== null &&
			typeof v === 'object' &&
			Object.values(v as Record<string, unknown>).every(
				(entry) => typeof entry === 'string',
			),
		'a string-to-string record',
	);
	keep('iconFor', isFunction, 'a function');
	keep('consoleEntriesKey', isFunction, 'a function');
	keep('parametersFor', isFunction, 'a function');
	keep('resultFor', isFunction, 'a function');
	keep('diagnosticsComponent', isFunction, 'a component');

	return { extension: extension as unknown as GizmoWebExtension, issues };
}
