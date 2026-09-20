import type { ProviderStatus } from '@gizmo/protocol';
import {
	defaultPiRuntimePaths,
	gizmoPiRuntimePaths,
	importPiRuntimeConfig,
	reimportPiAuth as importPiAuth,
} from '../config/pi-runtime-config';

let modelRuntimePromise:
	Promise<import('@earendil-works/pi-coding-agent').ModelRuntime> | undefined;

export function gizmoModelRuntime() {
	if (!modelRuntimePromise) {
		modelRuntimePromise = import('@earendil-works/pi-coding-agent')
			.then(async ({ getAgentDir, ModelRuntime }) => {
				const piWebMode = process.env.GIZMO_PI_WEB === '1';
				const paths = piWebMode
					? defaultPiRuntimePaths(getAgentDir())
					: gizmoPiRuntimePaths();
				if (!piWebMode) await importPiRuntimeConfig(paths.agentDir);
				return ModelRuntime.create({
					authPath: paths.authPath,
					modelsPath: paths.modelsPath,
					modelsStorePath: paths.modelsStorePath,
				});
			})
			.catch((error: unknown) => {
				// Let a later caller retry after configuration or auth is repaired.
				modelRuntimePromise = undefined;
				throw error;
			});
	}
	return modelRuntimePromise;
}

export async function listProviders(): Promise<ProviderStatus[]> {
	const runtime = await gizmoModelRuntime();
	return Promise.all(
		runtime.getProviders().map(async (provider) => {
			const auth = await runtime.checkAuth(provider.id);
			return {
				id: provider.id,
				name: provider.name,
				authenticated: Boolean(auth),
				...(auth?.source ? { source: auth.source } : {}),
				...(auth?.type ? { credentialType: auth.type } : {}),
				supportsApiKey: Boolean(provider.auth.apiKey),
				supportsOAuth: Boolean(provider.auth.oauth),
				modelCount: runtime.getModels(provider.id).length,
			};
		}),
	);
}

export async function reimportPiAuth(): Promise<ProviderStatus[]> {
	if (process.env.GIZMO_PI_WEB !== '1') await importPiAuth();
	modelRuntimePromise = undefined;
	return listProviders();
}

export async function setProviderApiKey(
	providerId: string,
	apiKey: string,
): Promise<ProviderStatus[]> {
	const id = providerId.trim();
	const key = apiKey.trim();
	if (!id) throw new Error('Unknown provider');
	if (!key) throw new Error('API key is required');
	const runtime = await gizmoModelRuntime();
	const provider = runtime.getProvider(id);
	if (!provider) throw new Error(`Unknown provider: ${id}`);
	if (!provider.auth.apiKey)
		throw new Error(`${provider.name} does not support API keys`);
	await runtime.setRuntimeApiKey(id, key);
	return listProviders();
}

/**
 * Resolve the key a provider would actually send, so settings can copy it.
 * `getAuth` is the only public read path — `checkAuth` withholds the secret
 * on purpose — and it also covers keys that come from the environment rather
 * than from auth.json, which is what the status line already reports.
 */
export async function readProviderApiKey(providerId: string): Promise<string> {
	const id = providerId.trim();
	if (!id) throw new Error('Unknown provider');
	const runtime = await gizmoModelRuntime();
	const provider = runtime.getProvider(id);
	if (!provider) throw new Error(`Unknown provider: ${id}`);
	const auth = await runtime.getAuth(id);
	const apiKey = auth?.auth.apiKey;
	if (!apiKey) throw new Error(`No API key is stored for ${provider.name}`);
	return apiKey;
}

export async function removeProviderApiKey(
	providerId: string,
): Promise<ProviderStatus[]> {
	const id = providerId.trim();
	if (!id) throw new Error('Unknown provider');
	const runtime = await gizmoModelRuntime();
	const provider = runtime.getProvider(id);
	if (!provider) throw new Error(`Unknown provider: ${id}`);
	await runtime.removeRuntimeApiKey(id);
	return listProviders();
}
