import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

/**
 * Gizmo updating itself. `check` reads the running version and the latest
 * published one; `start` installs the latest beside it. Progress after that
 * arrives as `app.update.changed` events, and the connection then drops
 * while the supervisor restarts the server on the new release: the
 * ordinary reconnect brings the tab back, and a fresh `check` shows the
 * version that is now running.
 */
export class UpdateCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async check(refresh = false) {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.appUpdateBusy = true;
		store.appUpdateError = undefined;
		try {
			store.appUpdate = await this.client.appUpdateStatus(refresh);
		} catch (error) {
			store.appUpdateError = errorMessage(error);
		} finally {
			store.appUpdateBusy = false;
		}
	}

	async start(version?: string) {
		const store = this.store;
		if (store.connection !== 'connected') return false;
		store.appUpdateBusy = true;
		store.appUpdateError = undefined;
		try {
			store.appUpdate = await this.client.appUpdateStart(version);
			return true;
		} catch (error) {
			store.appUpdateError = errorMessage(error);
			return false;
		} finally {
			store.appUpdateBusy = false;
		}
	}
}
