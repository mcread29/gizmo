import { parseAgentEvent, protocolVersion } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	applyAgentEvent,
	type AgentEventState,
} from '../../../src/lib/agent-client/agent-event-reducer';

function state(): AgentEventState {
	return {
		activeTools: [],
		sessionState: 'idle',
		compacting: false,
		unsent: [],
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
		projectStatuses: {},
		projectServiceErrors: {},
	};
}

const envelope = { protocolVersion, sessionId: 'session-1' } as const;

describe('applyAgentEvent', () => {
	it('stores partial results while running and preserves them across text-only updates', () => {
		const target = state();
		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'message.started',
			messageId: 'message-1',
			role: 'assistant',
			createdAt: 1,
		});
		applyAgentEvent(target, {
			...envelope,
			eventId: 2,
			type: 'tool.started',
			messageId: 'message-1',
			toolCallId: 'tool-1',
			toolName: 'display',
			input: {},
		});
		const result = { gizmoDisplay: { state: 'waiting', title: 'Choose' } };
		applyAgentEvent(
			target,
			parseAgentEvent(
				JSON.parse(
					JSON.stringify({
						...envelope,
						eventId: 3,
						type: 'tool.updated',
						toolCallId: 'tool-1',
						message: 'Waiting for input',
						result,
					}),
				),
			),
		);
		const tool = target.messages[0]?.tools[0];
		expect(tool).toMatchObject({
			status: 'running',
			statusText: 'Waiting for input',
			result,
		});
		for (const update of [{}, { result: undefined }]) {
			applyAgentEvent(target, {
				...envelope,
				eventId: 4,
				type: 'tool.updated',
				toolCallId: 'tool-1',
				message: 'Still waiting',
				...update,
			});
			expect(tool).toMatchObject({
				status: 'running',
				statusText: 'Still waiting',
				result,
			});
		}
		const replacement = {
			gizmoDisplay: { state: 'waiting', title: 'Updated' },
		};
		applyAgentEvent(target, {
			...envelope,
			eventId: 5,
			type: 'tool.updated',
			toolCallId: 'tool-1',
			message: 'Updated',
			result: replacement,
		});
		expect(tool).toMatchObject({ status: 'running', result: replacement });
		applyAgentEvent(target, {
			...envelope,
			eventId: 6,
			type: 'tool.completed',
			toolCallId: 'tool-1',
			result: 'Answered',
			isError: false,
		});
		expect(tool).toMatchObject({ status: 'complete', result: 'Answered' });
	});

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

	it('records completed automatic compaction and invalidates stale usage', () => {
		const target = state();
		target.usage = {
			input: 100,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			contextUsed: 120,
			cost: 0,
		};

		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'session.compaction',
			active: false,
			reason: 'threshold',
		});

		expect(target.usage).toBeUndefined();
		expect(target.lastAutomaticCompactionReason).toBe('threshold');
	});

	it('does not label manual compaction as automatic', () => {
		const target = state();

		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'session.compaction',
			active: false,
			reason: 'manual',
		});

		expect(target.lastAutomaticCompactionReason).toBeUndefined();
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

	it('collects messages a dead run never delivered', () => {
		const target = state();

		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'session.unsent',
			messages: ['path'],
		});

		expect(target.unsent).toEqual(['path']);
	});

	it('marks a message the provider stopped short as interrupted', () => {
		const target = state();

		applyAgentEvent(target, {
			...envelope,
			eventId: 1,
			type: 'message.started',
			messageId: 'message-1',
			role: 'assistant',
			createdAt: 1,
		});
		applyAgentEvent(target, {
			...envelope,
			eventId: 2,
			type: 'message.completed',
			messageId: 'message-1',
			interrupted: true,
		});

		expect(target.messages[0]).toMatchObject({
			complete: true,
			interrupted: true,
		});
	});
});
