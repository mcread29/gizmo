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
