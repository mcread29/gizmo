import type { ConversationMessage, ToolCallView } from '@gizmo/protocol';
import { toolLabel } from './tool-labels';

export interface StreamingActivity {
	streaming: boolean;
	/** What the agent is doing right now, in the user's words. */
	label: string;
	startedAt?: number;
}

export function streamingActivity(
	messages: ConversationMessage[],
	sessionState: string,
): StreamingActivity {
	const last = messages.at(-1);
	if (sessionState !== 'streaming' || !last || last.role !== 'assistant') {
		return { streaming: false, label: 'Idle' };
	}
	const running = last.tools.find(
		(tool: ToolCallView) => tool.status === 'running',
	);
	if (running) {
		return {
			streaming: true,
			label: toolLabel(running.name),
			startedAt: last.createdAt,
		};
	}
	return {
		streaming: true,
		label: last.content ? 'Responding' : 'Thinking',
		startedAt: last.createdAt,
	};
}

export function formatElapsed(milliseconds: number): string {
	const seconds = Math.max(0, Math.round(milliseconds / 1000));
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
