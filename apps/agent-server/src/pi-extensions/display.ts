import {
	defineTool,
	type ExtensionAPI,
	type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
	displayParametersSchema,
	parseDisplaySpec,
	type DisplayInput,
	type DisplayResponse,
	type DisplayResult,
} from '@gizmo/protocol';
import { Value } from 'typebox/value';

export const displayGuidance =
	'Use display to present structured cards, tables, lists, or metrics in Gizmo. Supply only static catalog props (plain text, never HTML, actions, or expressions). Add input only when you need a user answer; display then waits for text, select, or confirm. Confirm false means No or dismissed, not explicit approval.';

export function createDisplayTool() {
	return defineTool({
		name: 'display',
		label: 'Display',
		description:
			'Show a static structured display in Gizmo, optionally waiting for user input. Catalog: Heading{text,level?:1|2|3}, Text{text}, Card{title?}, Stack{}, List{items:string[]}, Table{columns:string[],rows:string[][]}, Metric{label:string,value:string,description?:string}, Divider{}. Only Card/Stack contain children (element IDs). One rooted tree, at most 100 elements and depth 16; strings <=4000 characters, titles <=200, total string/key budget 64000 characters. No HTML rendering, actions, bindings, or dynamic expressions. Example: {"title":"Build","spec":{"root":"card","elements":{"card":{"type":"Card","props":{"title":"Results"},"children":["metric"]},"metric":{"type":"Metric","props":{"label":"Tests passed","value":"42"}}}},"input":{"kind":"confirm","prompt":"Continue?","message":"Proceed with these results?"}}. Input requires UI; the display is published before waiting. Text/select dismissal or abort returns cancelled. Confirm false is submitted false (No or dismissal are indistinguishable); abort is cancelled. Text responses are limited to 4000 characters.',
		promptSnippet:
			'Present static cards, tables, lists, and metrics; optionally wait for user input',
		promptGuidelines: [displayGuidance],
		parameters: displayParametersSchema,
		async execute(_id, params, signal, onUpdate, ctx) {
			const spec = parseDisplaySpec(params.spec);
			if (!spec || !Value.Check(displayParametersSchema, params)) {
				throw new Error(
					'Invalid display parameters: use the bounded static catalog and a single rooted tree.',
				);
			}
			const details: DisplayResult = {
				gizmoDisplay: {
					version: 1,
					...(params.title !== undefined ? { title: params.title } : {}),
					spec,
				},
			};
			if (!params.input) return result('Display published.', details);
			if (!ctx.hasUI)
				throw new Error(
					'display input requires an interactive UI; no input was requested because ctx.hasUI is false.',
				);
			onUpdate?.(result('Display published; waiting for user input.', details));
			const response = await requestInput(params.input, ctx, signal);
			return result(`Display input response: ${JSON.stringify(response)}`, {
				...details,
				response,
			});
		},
	});
}

function result(text: string, details: DisplayResult) {
	return { content: [{ type: 'text' as const, text }], details };
}

async function requestInput(
	input: DisplayInput,
	ctx: Pick<ExtensionContext, 'ui'>,
	signal?: AbortSignal,
): Promise<DisplayResponse> {
	if (signal?.aborted) return { status: 'cancelled' };
	// Race as well as forwarding the signal: even a non-cooperative UI cannot hang a cancelled tool.
	let cancel: (() => void) | undefined;
	const aborted = new Promise<undefined>((resolve) => {
		cancel = () => resolve(undefined);
		signal?.addEventListener('abort', cancel, { once: true });
	});
	try {
		const options = { signal };
		const pending =
			input.kind === 'text'
				? ctx.ui.input(input.prompt, input.placeholder, options)
				: input.kind === 'select'
					? ctx.ui.select(input.prompt, input.options, options)
					: ctx.ui.confirm(input.prompt, input.message, options);
		const value = await Promise.race([pending, aborted]);
		if (signal?.aborted || value === undefined) return { status: 'cancelled' };
		if (
			input.kind === 'confirm'
				? typeof value !== 'boolean'
				: typeof value !== 'string'
		)
			throw new Error('Invalid display input response type.');
		if (
			typeof value === 'string' &&
			(value.length > 4_000 ||
				(input.kind === 'select' && !input.options.includes(value)))
		)
			throw new Error(
				'Invalid display input response: too long or not a listed option.',
			);
		return { status: 'submitted', value };
	} catch (error) {
		if (signal?.aborted) return { status: 'cancelled' };
		throw error;
	} finally {
		if (cancel) signal?.removeEventListener('abort', cancel);
	}
}

export default function display(pi: ExtensionAPI) {
	pi.registerTool(createDisplayTool());
	pi.on('before_agent_start', (event) => {
		if (event.systemPrompt.includes(displayGuidance)) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${displayGuidance}` };
	});
}
