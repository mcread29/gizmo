import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { PiExtensionUiRuntime } from '../sessions/pi-extension-ui-runtime';

/**
 * Offered as the last choice whenever the tool asks a multiple-choice
 * question, so the user can always answer in their own words: picking it
 * makes the tool follow up with a free-text input.
 */
const freeTextOption = 'Write my own answer…';

const noAnswer =
	'The user did not answer the question (it was dismissed or timed out). Continue without their input or ask again later.';

/**
 * Lets the agent ask the user a question mid-task and wait for the answer.
 * The question renders inline in the chat as an interactive card backed by
 * the extension UI bridge; `options` makes it multiple choice, and without
 * them the user gets a free-text field.
 */
export function createAskUserTool(ui: PiExtensionUiRuntime) {
	return defineTool({
		name: 'ask_user',
		label: 'Ask the user',
		description:
			"Ask the user a question and wait for their answer. Provide two or more options for a multiple-choice question; omit them for a free-text answer. Use this when a decision needs the user's input — never for information you can look up yourself.",
		promptSnippet: 'Ask the user a question and wait for the answer',
		promptGuidelines: [
			'The question must be self-contained: the user sees only this text and the options.',
			'Offer options whenever the answer is a choice between known alternatives.',
		],
		parameters: Type.Object(
			{
				question: Type.String({ minLength: 1, maxLength: 500 }),
				options: Type.Optional(
					Type.Array(Type.String({ minLength: 1, maxLength: 2_000 }), {
						minItems: 2,
						maxItems: 12,
					}),
				),
			},
			{ additionalProperties: false },
		),
		async execute(_toolCallId, params, signal) {
			if (params.options?.length) {
				const choice = await ui.context.select(
					params.question,
					[...params.options, freeTextOption],
					{ signal },
				);
				if (choice === undefined) return unanswered();
				if (choice !== freeTextOption) return answered(choice);
			}
			const answer = await ui.context.input(
				params.question,
				'Type your answer…',
				{ signal },
			);
			return answer === undefined ? unanswered() : answered(answer);
		},
	});
}

interface AskUserToolResult {
	content: { type: 'text'; text: string }[];
	details: { answer: string | null };
}

function answered(answer: string): AskUserToolResult {
	return { content: [{ type: 'text', text: answer }], details: { answer } };
}

function unanswered(): AskUserToolResult {
	return {
		content: [{ type: 'text', text: noAnswer }],
		details: { answer: null },
	};
}
