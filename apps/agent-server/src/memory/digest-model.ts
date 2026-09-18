import { randomUUID } from 'node:crypto';
import { providerSessionHeaders } from '../sessions/commit-message';
import { gizmoModelRuntime } from '../sessions/pi-model-runtime';
import type { CompleteText, DigestModelRef } from './digest-generator';
import { formatModelRef } from './digest-generator';

/**
 * A digest is a few hundred tokens, but a reasoning model spends its budget
 * on reasoning first and only then writes the answer. Budgeting for the
 * answer alone starved those models: they burned the cap thinking and
 * returned empty content, which reads downstream as "not a digest".
 */
const maxDigestTokens = 8_000;

/**
 * Binds digest generation to Gizmo's own model runtime.
 *
 * Digests deliberately do not reach for a provider SDK of their own: the
 * runtime already owns provider composition, credentials and availability, so
 * a digest model is any model the user has authenticated for chat.
 *
 * Resolution goes through `getAvailable` because that is what the picker
 * lists. `getModel` sees only statically configured models, while a provider
 * that lists its own catalogue over the network contributes models that exist
 * for the picker and not for `getModel` — choosing one of those would then
 * fail on every segment. The two calls return the same objects where they
 * overlap, so the fallback is only for a model the availability refresh
 * could not reach.
 */
export async function completeWithGizmoModel(
	model: DigestModelRef,
): Promise<CompleteText> {
	const runtime = await gizmoModelRuntime();
	type Available = Awaited<ReturnType<typeof runtime.getAvailable>>;
	// An availability refresh reaches the network, so it can fail on its own;
	// falling back to the static catalogue beats failing the digest outright.
	const available = await runtime.getAvailable().catch((): Available => []);
	const resolved =
		available.find(
			(candidate) =>
				candidate.provider === model.provider && candidate.id === model.id,
		) ?? runtime.getModel(model.provider, model.id);
	if (!resolved) {
		throw new Error(
			`No such model: ${formatModelRef(model)}. Choose a different digest model.`,
		);
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
