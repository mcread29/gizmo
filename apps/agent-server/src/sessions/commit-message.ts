import type { AgentSession } from '@earendil-works/pi-coding-agent';

/** The user's own house style for generated commit messages. */
export const commitMessagePrompt = [
	'Write a commit message for my changes.',
	'Explain what were the changes and why the changes were done.',
	'Focus the most important changes.',
	'Use the present tense.',
	'Use a single word lowercase commit prefix.',
	'Hard wrap lines at 72 characters.',
	'Ensure the title is less than 50 (soft limit) and 70 (hard limit).',
	'Do not start any lines with the hash symbol.',
	'Only respond with the commit message.',
].join('\n');

type CommitSession = Pick<AgentSession, 'model' | 'sessionId' | 'modelRuntime'>;

/**
 * Asks the thread's model for a commit message over the Git extension's
 * diff context. A bare runtime call skips the per-request headers Pi's agent
 * loop adds, and OpenCode's gateway refuses anything without its session
 * header, which is how this died with "Request is missing
 * x-opencode-session" while chat on the same model kept working.
 */
export async function generateCommitMessage(
	session: CommitSession,
	context: string,
): Promise<string> {
	const model = session.model;
	if (!model) throw new Error('No model is selected');
	const message = await session.modelRuntime.completeSimple(
		model,
		{
			systemPrompt: commitMessagePrompt,
			messages: [{ role: 'user', content: context, timestamp: Date.now() }],
		},
		{
			maxTokens: 1500,
			sessionId: session.sessionId,
			transformHeaders: (headers) => ({
				...headers,
				...providerSessionHeaders(model, session.sessionId),
			}),
		},
	);
	if (message.stopReason === 'error') {
		throw new Error(
			message.errorMessage || 'Pi could not generate a commit message',
		);
	}
	const text = cleanCommitMessage(
		message.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text)
			.join(''),
	);
	if (!text) throw new Error('Pi returned an empty commit message');
	return text;
}

const opencodeHost = 'opencode.ai';

/** The session header OpenCode requires, mirroring Pi's own attribution. */
export function providerSessionHeaders(
	model: { provider: string; baseUrl?: string },
	sessionId: string,
): Record<string, string> {
	const opencode =
		model.provider === 'opencode' ||
		model.provider === 'opencode-go' ||
		hostOf(model.baseUrl) === opencodeHost;
	return opencode
		? { 'x-opencode-session': sessionId, 'x-opencode-client': 'pi' }
		: {};
}

function hostOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).hostname;
	} catch {
		return undefined;
	}
}

/** Pi's text answer, minus the fences models add despite being asked not to. */
export function cleanCommitMessage(text: string): string {
	return text
		.trim()
		.replace(/^```(?:text)?\s*|\s*```$/g, '')
		.trim();
}
