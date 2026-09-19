import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(
	fileURLToPath(import.meta.resolve('@gizmo/extension-api')),
);
export const extensionApiAliases: Record<string, string> = {
	'@gizmo/extension-api': join(root, 'index.ts'),
	'@gizmo/extension-api/display-schema': join(root, 'display-schema.ts'),
};
let registered = false;

/** Pi's own loader must resolve the same host API as Gizmo's integration loader. */
export function ensureExtensionApiResolution(): void {
	if (registered) return;
	registerHooks({
		resolve(specifier, context, nextResolve) {
			const target = Object.hasOwn(extensionApiAliases, specifier)
				? extensionApiAliases[specifier]!
				: specifier;
			return nextResolve(target, context);
		},
	});
	registered = true;
}
