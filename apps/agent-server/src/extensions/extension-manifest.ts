import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseExtensionManifest } from '@gizmo/extensions';

/** Legacy Pi extensions remain usable without a Gizmo sidecar. */
export async function readExtensionManifest(
	dir: string,
	requireSupported = true,
) {
	let source: string;
	try {
		source = await readFile(join(dir, 'gizmo.json'), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
	try {
		return parseExtensionManifest(JSON.parse(source), requireSupported);
	} catch (error) {
		throw new Error(
			`Invalid extension manifest in ${dir}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export function validateExtensionId(id: string): void {
	if (!/^[a-z0-9][a-z0-9.-]*$/i.test(id)) {
		throw new Error(`Invalid extension id: ${id}`);
	}
}
