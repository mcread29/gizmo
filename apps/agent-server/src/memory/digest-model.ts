import { randomUUID } from 'node:crypto';
import { providerSessionHeaders } from '../sessions/commit-message';
import { gizmoModelRuntime } from '../sessions/pi-model-runtime';
import type { CompleteText, DigestModelRef } from './digest-generator';
import { formatModelRef } from './digest-generator';

/** A digest is a few hundred tokens; this only bounds a runaway answer. */
const maxDigestTokens = 1_200;

/**
 * Binds digest generation to Gizmo's own model runtime.
 *
 * Digests deliberately do not reach for a provider SDK of their own: the
 * runtime already owns provider composition, credentials and availability, so
 * a digest model is any model the user has authenticated for chat. That is
 * also what makes the model selectable — the picker and this function read the
 * same catalogue.
 */
export async function completeWithGizmoModel(
	model: DigestModelRef,
): Promise<CompleteText> {
	const runtime = await gizmoModelRuntime();
	const resolved = runtime.getModel(model.provider, model.id);
	if (!resolved) {
		throw new Error(`No such model: ${formatModelRef(model)}`);
	}

	// A digest is not a conversation, but the gateways still want a session to
	// attribute the request to. One id per backfill run keeps the whole run
	// attributable together rather than inventing an identity per segment.
	const sessionId = `gizmo-digest-${randomUUID()}`;

	return async (systemPrompt, prompt, signal) => {
		const message = await runtime.completeSimple(
			resolved,
			{
				systemPrompt,
				messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
			},
			{
				maxTokens: maxDigestTokens,
				sessionId,
				...(signal ? { signal } : {}),
				// A bare runtime call skips the per-request headers Pi's agent loop
				// adds, and OpenCode's gateway rejects anything without its session
				// header — the same failure `generateCommitMessage` documents.
				transformHeaders: (headers) => ({
					...headers,
					...providerSessionHeaders(resolved, sessionId),
				}),
			},
		);
		// completeSimple reports provider failures on the message rather than
		// throwing, so an unchecked call returns empty text and looks like a
		// model that had nothing to say.
		if (message.stopReason === 'error') {
			throw new Error(message.errorMessage || 'The digest model failed');
		}
		return message.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text)
			.join('')
			.trim();
	};
}
