import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModelSetting } from '@gizmo/extension-api';
import type { GlobalModelCatalog } from '@gizmo/protocol';
import { piAgentDir } from '../extensions/extension-settings-store';
import { providerSessionHeaders } from './commit-message';
import { gizmoModelRuntime } from './pi-model-runtime';

/**
 * Pi's thinking levels. The per-session catalog asks the session, which
 * clamps to the model in play; with no session, every level is offered and
 * the provider clamps what it cannot honour.
 */
export const thinkingLevels = [
	'off',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
	'max',
] as const;

/** The model catalog with no session: what global settings pick from. */
export async function globalModelCatalog(): Promise<GlobalModelCatalog> {
	const runtime = await gizmoModelRuntime();
	const models = await runtime.getAvailable();
	return {
		models: models
			.map((model) => ({
				provider: model.provider,
				id: model.id,
				name: model.name,
				reasoning: model.reasoning,
				...(model.contextWindow > 0
					? { contextWindow: model.contextWindow }
					: {}),
			}))
			.sort((left, right) =>
				`${left.provider}/${left.name}`.localeCompare(
					`${right.provider}/${right.name}`,
				),
			),
		thinkingLevels: [...thinkingLevels],
	};
}

/** One text completion, with no session and no agent loop around it. */
export interface HostCompletionRequest {
	/** The model a `model` setting holds; the host default when unset. */
	model?: ModelSetting;
	systemPrompt?: string;
	prompt: string;
	maxTokens?: number;
}

/** The session id the host attributes its own completions to. */
const hostSessionId = 'gizmo-host';

/**
 * Completes a prompt for a host-side caller (an extension view, a commit
 * message) using the model registry sessions share. Providers that demand a
 * session header get the same treatment a thread's own request gets.
 */
export async function completeText(
	request: HostCompletionRequest,
): Promise<string> {
	const runtime = await gizmoModelRuntime();
	const model = request.model
		? runtime.getModel(request.model.provider, request.model.id)
		: await defaultModel();
	if (!model) {
		throw new Error(
			request.model
				? `Unknown model: ${request.model.provider}/${request.model.id}`
				: 'No model is available',
		);
	}
	const message = await runtime.completeSimple(
		model,
		{
			...(request.systemPrompt ? { systemPrompt: request.systemPrompt } : {}),
			messages: [
				{ role: 'user', content: request.prompt, timestamp: Date.now() },
			],
		},
		{
			maxTokens: request.maxTokens ?? 1500,
			sessionId: hostSessionId,
			...(request.model?.thinkingLevel
				? { reasoning: request.model.thinkingLevel as 'medium' }
				: {}),
			transformHeaders: (headers) => ({
				...headers,
				...providerSessionHeaders(model, hostSessionId),
			}),
		},
	);
	if (message.stopReason === 'error')
		throw new Error(message.errorMessage || 'The model returned an error');
	const text = message.content
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('')
		.trim();
	if (!text) throw new Error('The model returned no text');
	return text;
}

/** Pi's configured default model, else the first available one. */
async function defaultModel() {
	const runtime = await gizmoModelRuntime();
	const settings = await readSettings();
	const configured =
		settings.defaultProvider && settings.defaultModel
			? runtime.getModel(settings.defaultProvider, settings.defaultModel)
			: undefined;
	if (configured) return configured;
	return (await runtime.getAvailable())[0];
}

async function readSettings(): Promise<{
	defaultProvider?: string;
	defaultModel?: string;
}> {
	try {
		const parsed: unknown = JSON.parse(
			await readFile(join(piAgentDir(), 'settings.json'), 'utf8'),
		);
		return typeof parsed === 'object' && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}
