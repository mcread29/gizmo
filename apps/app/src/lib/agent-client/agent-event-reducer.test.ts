import { protocolVersion } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { applyAgentEvent, type AgentEventState } from './agent-event-reducer';

function state(): AgentEventState {
	return {
		activeTools: [],
		sessionState: 'idle',
		compacting: false,
		messages: [],
		sessions: [
			{
				id: 'session-1',
				title: 'Thread',
				createdAt: 1,
				lastActiveAt: 1,
				messageCount: 0,
			},
		],
		sessionId: 'session-1',
		projectExtensions: [],
	};
}

const envelope = { protocolVersion, sessionId: 'session-1' } as const;

describe('applyAgentEvent', () => {
	it('replaces project extension descriptors when discovery changes', () => {
		const target = state();
		target.selectedProjectPath = '/projects/game';

		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'project.extensions.changed',
			projectPath: '/projects/game',
			extensions: [
				{
					id: 'com.gizmo.extras.console',
					name: 'Console',
					version: '0.1.0',
					apiVersion: 1,
					capabilities: ['unity.console'],
					operations: [],
				},
			],
		});

		expect(target.projectExtensions[0]?.id).toBe('com.gizmo.extras.console');
	});

	it('owns transcript and tool-call progression', () => {
		const target = state();
		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'message.started',
			messageId: 'message-1',
			role: 'assistant',
			createdAt: 10,
		});
		applyAgentEvent(target, {
			...envelope,
			eventId: 2,
			type: 'message.delta',
			messageId: 'message-1',
			delta: 'Ready',
		});
		applyAgentEvent(target, {
			...envelope,
			eventId: 3,
			type: 'tool.started',
			messageId: 'message-1',
			toolCallId: 'tool-1',
			toolName: 'unity_status',
			input: undefined,
		});
		applyAgentEvent(target, {
			...envelope,
			eventId: 4,
			type: 'tool.completed',
			toolCallId: 'tool-1',
			result: { ok: true },
			isError: false,
		});

		expect(target.sessions[0]?.messageCount).toBe(1);
		expect(target.messages[0]).toMatchObject({
			content: 'Ready',
			tools: [
				{
					name: 'unity_status',
					status: 'complete',
					statusText: 'Completed',
					result: { ok: true },
				},
			],
		});
	});
});
