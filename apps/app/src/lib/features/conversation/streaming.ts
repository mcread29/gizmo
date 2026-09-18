import type { ConversationMessage, ToolCallView } from '@gizmo/protocol';
import { toolLabel } from './tool-labels';

export interface StreamingActivity {
	streaming: boolean;
	/** What the agent is doing right now, in the user's words. */
	label: string;
	startedAt?: number;
	indicator?: string;
}

export interface StreamingActivityOverride {
	message?: string | null;
	visible?: boolean;
	frames?: string[] | null;
}

export function streamingActivity(
	messages: ConversationMessage[],
	sessionState: string,
	override?: StreamingActivityOverride,
): StreamingActivity {
	const last = messages.at(-1);
	if (sessionState !== 'streaming' || !last || last.role !== 'assistant') {
		return { streaming: false, label: 'Idle' };
	}
	// setWorkingVisible(false) withdraws the extension's own message and
	// spinner; it cannot make a running turn look idle, which used to leave the
	// composer in steer mode under a titlebar that claimed nothing was going on.
	const custom =
		override?.visible === false
			? {}
			: {
					...(override?.message ? { label: override.message } : {}),
					...(override?.frames?.[0] ? { indicator: override.frames[0] } : {}),
				};
	const running = last.tools.find(
		(tool: ToolCallView) => tool.status === 'running',
	);
	// The elapsed time is the whole turn's, not this step's: a long run is a
	// sequence of tool calls and replies, and restarting the count at each one
	// hid how long the agent had actually been working.
	const startedAt = turnStart(messages);
	if (running) {
		return {
			streaming: true,
			label: toolLabel(running.name),
			startedAt,
			...custom,
		};
	}
	return {
		streaming: true,
		label: last.content ? 'Responding' : 'Thinking',
		startedAt,
		...custom,
	};
}

/**
 * When the agent started working on the turn in flight: the first assistant
 * message written since the user last spoke, falling back to the user's own
 * message while none has arrived yet.
 */
export function turnStart(messages: ConversationMessage[]): number | undefined {
	let start: number | undefined;
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role === 'user') return start ?? message.createdAt;
		if (message.role === 'assistant') start = message.createdAt;
	}
	return start;
}

export function formatElapsed(milliseconds: number): string {
	const seconds = Math.max(0, Math.round(milliseconds / 1000));
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
