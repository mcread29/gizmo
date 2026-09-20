import type { RegistryStatus } from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';
import { errorMessage } from './shared';

export class RegistryCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async refreshProviders() {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.providersLoading = true;
		store.providerError = undefined;
		try {
			store.providers = await this.client.listProviders();
		} catch (error) {
			store.providerError = errorMessage(error);
		} finally {
			store.providersLoading = false;
		}
	}

	async reimportPiAuth() {
		const store = this.store;
		if (store.connection !== 'connected') return false;
		store.providersLoading = true;
		store.providerError = undefined;
		try {
			store.providers = await this.client.reimportPiAuth();
			return true;
		} catch (error) {
			store.providerError = errorMessage(error);
			return false;
		} finally {
			store.providersLoading = false;
		}
	}

	async setProviderApiKey(providerId: string, apiKey: string) {
		const store = this.store;
		if (store.connection !== 'connected') return false;
		store.providersLoading = true;
		store.providerError = undefined;
		try {
			store.providers = await this.client.setProviderApiKey(providerId, apiKey);
			return true;
		} catch (error) {
			store.providerError = errorMessage(error);
			return false;
		} finally {
			store.providersLoading = false;
		}
	}

	async removeProviderApiKey(providerId: string) {
		const store = this.store;
		if (store.connection !== 'connected') return false;
		store.providersLoading = true;
		store.providerError = undefined;
		try {
			store.providers = await this.client.removeProviderApiKey(providerId);
			return true;
		} catch (error) {
			store.providerError = errorMessage(error);
			return false;
		} finally {
			store.providersLoading = false;
		}
	}

	/**
	 * Reads a key back so it can be copied. Unlike the write paths this leaves
	 * `providerError` alone and throws: the caller is one button, and a failure
	 * belongs in its toast rather than above the whole list.
	 */
	async readProviderApiKey(providerId: string) {
		if (this.store.connection !== 'connected')
			throw new Error('Not connected to the agent server');
		return this.client.readProviderApiKey(providerId);
	}

	async refreshRegistry() {
		const store = this.store;
		if (store.connection !== 'connected') return;
		store.registryBusy = true;
		store.registryError = undefined;
		try {
			store.registryStatus = await this.client.registryStatus();
		} catch (error) {
			store.registryError = errorMessage(error);
		} finally {
			store.registryBusy = false;
		}
	}

	registryUpdate() {
		return this.#registryAction(() => this.client.registryUpdate());
	}

	registryLink(id: string) {
		return this.#registryAction(() => this.client.registryLink(id));
	}

	registryUnlink(id: string) {
		return this.#registryAction(() => this.client.registryUnlink(id));
	}

	async #registryAction(action: () => Promise<RegistryStatus>) {
		this.store.registryBusy = true;
		this.store.registryError = undefined;
		try {
			this.store.registryStatus = await action();
			// The server re-registered its catalog; pick up the new bundles,
			// descriptors and enablement so the change shows without a restart.
			// A failure here is logged, not raised: the registry action itself
			// succeeded, and reporting it as failed would invite a retry that
			// cannot help.
			try {
				await this.store.reloadExtensions({ server: false });
			} catch (error) {
				console.warn('Extensions did not refresh after registry change', error);
			}
			return true;
		} catch (error) {
			this.store.registryError = errorMessage(error);
			return false;
		} finally {
			this.store.registryBusy = false;
		}
	}
}
