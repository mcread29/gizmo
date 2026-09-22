import { defaultCompactionPolicy } from '@gizmo/protocol';
import { protocolVersion } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	applyAgentEvent,
	type AgentEventState,
} from '../../../src/lib/agent-client/agent-event-reducer';

const envelope = { protocolVersion, sessionId: 'session-1' } as const;

function finished(): AgentEventState {
	return {
		activeTools: [],
		sessionState: 'idle',
		compacting: false,
		unsent: [],
		queue: { steering: [], followUp: [] },
		messages: [
			{
				id: 'message-1',
				role: 'assistant',
				content: 'Done',
				createdAt: 10,
				complete: true,
				tools: [],
			},
		],
		sessions: [],
		sessionId: 'session-1',
		compactionPolicy: defaultCompactionPolicy,
		projectExtensions: [],
		projectStatuses: {},
		projectServiceErrors: {},
	};
}

describe('turn timing', () => {
	it('times a run it watched end, and leaves an old thread alone', () => {
		const watched = finished();
		watched.sessionState = 'streaming';
		applyAgentEvent(watched, {
			...envelope,
			eventId: 1,
			type: 'session.state',
			state: 'idle',
		});
		expect(watched.messages[0]!.completedAt).toBeGreaterThan(0);

		// Opening a thread that finished days ago also reports idle. Stamping
		// that moment would claim the agent worked the whole time since.
		const reopened = finished();
		applyAgentEvent(reopened, {
			...envelope,
			eventId: 1,
			type: 'session.state',
			state: 'idle',
		});
		expect(reopened.messages[0]!.completedAt).toBeUndefined();
	});
});
