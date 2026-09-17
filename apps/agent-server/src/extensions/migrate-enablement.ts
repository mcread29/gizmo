import { GlobalResourceStore } from '../resources/global-resource-settings';
import {
	listPiExtensions,
	setPiExtensionEnabled,
} from '../resources/pi-global-resources';

/** Preserve legacy global opt-outs when Pi becomes the source of truth. */
export async function migrateExtensionEnablement() {
	const store = new GlobalResourceStore();
	const settings = await store.read();
	if (!settings.disabledGizmoExtensions.length) return;
	const installed = new Set((await listPiExtensions()).map(({ id }) => id));
	const migrated = new Set<string>();
	for (const id of settings.disabledGizmoExtensions) {
		if (!installed.has(id)) continue;
		await setPiExtensionEnabled(id, false);
		migrated.add(id);
	}
	if (migrated.size)
		await store.write({
			...settings,
			disabledGizmoExtensions: settings.disabledGizmoExtensions.filter(
				(id) => !migrated.has(id),
			),
		});
}
