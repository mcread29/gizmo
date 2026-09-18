import type { AgentSession } from '@earendil-works/pi-coding-agent';

/**
 * A thread name is read in a narrow rail, so it is asked for as a label
 * rather than a sentence: no punctuation to truncate, no restatement of the
 * request, nothing the first message already says at a glance.
 */
export const sessionTitlePrompt = [
	'Write a short title for a coding thread that starts with this message.',
	'Use at most six words.',
	'Use sentence case and no trailing punctuation.',
	'Name the work, not the person asking for it.',
	'Do not answer the message or add commentary.',
	'Only respond with the title.',
].join('\n');

type TitleSession = Pick<AgentSession, 'model' | 'sessionId' | 'modelRuntime'>;

export interface TitleModel {
	provider: string;
	id: string;
}

/**
 * Names a thread from its opening message, on a model the user picked for the
 * purpose rather than the one the thread runs on — the job is small enough
 * that it should not be billed at the coding model's rate. Falls back to the
 * thread's own model when no title model is configured.
 */
export async function generateSessionTitle(
	session: TitleSession,
	text: string,
	titleModel?: TitleModel,
): Promise<string> {
	// The runtime owns model identity; a provider/id pair off the wire is only
	// a reference to one. An unknown pair falls back to the thread's own model
	// rather than failing, so a stale setting cannot stop threads being named.
	const model =
		(titleModel &&
			session.modelRuntime.getModel(titleModel.provider, titleModel.id)) ||
		session.model;
	if (!model) throw new Error('No model is selected');
	const message = await session.modelRuntime.completeSimple(
		model,
		{
			systemPrompt: sessionTitlePrompt,
			messages: [{ role: 'user', content: text, timestamp: Date.now() }],
		},
		{ maxTokens: 200, sessionId: session.sessionId },
	);
	if (message.stopReason === 'error') {
		throw new Error(message.errorMessage || 'The model returned no title');
	}
	const title = cleanTitle(
		message.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text)
			.join(''),
	);
	if (!title) throw new Error('The model returned an empty title');
	return title;
}

/**
 * Small models like to wrap a title in quotes, prefix it with "Title:", or
 * think out loud first. Keep the last non-empty line and strip the dressing.
 */
export function cleanTitle(raw: string): string {
	const line =
		raw
			.replace(/<think>[\s\S]*?<\/think>/gi, '')
			.split('\n')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.at(-1) ?? '';
	return line
		.replace(/^(?:title|thread)\s*[:\-—]\s*/i, '')
		.replace(/^["'`*\s]+|["'`*.\s]+$/g, '')
		.slice(0, 80);
}
