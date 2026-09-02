import { parseAgentEvent, type AgentEvent } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	createTestService,
	FakePiSession,
	piEvent,
} from './support/pi-agent-service-fixtures';

describe('PiAgentService events', () => {
	it('translates Pi streaming and tool events into the shared protocol', async () => {
		const pi = new FakePiSession();
		const service = await createTestService(pi);
		const events: AgentEvent[] = [];
		service.subscribe((input) => events.push(parseAgentEvent(input)));
		await service.createSession();

		const assistant = {
			role: 'assistant',
			content: [],
			timestamp: 2,
			api: 'anthropic-messages',
			provider: 'anthropic',
			model: 'test',
			usage: {},
			stopReason: 'stop',
		};
		pi.emit(piEvent({ type: 'agent_start' }));
		pi.emit(
			piEvent({
				type: 'message_start',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(
			piEvent({
				type: 'message_end',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(piEvent({ type: 'message_start', message: assistant }));
		pi.emit(
			piEvent({
				type: 'message_update',
				message: assistant,
				assistantMessageEvent: {
					type: 'text_delta',
					delta: 'Working',
					contentIndex: 0,
					partial: assistant,
				},
			}),
		);
		pi.emit(piEvent({ type: 'message_end', message: assistant }));
		pi.emit(
			piEvent({
				type: 'tool_execution_start',
				toolCallId: 'tool-1',
				toolName: 'unity_status',
				args: {},
			}),
		);
		pi.emit(
			piEvent({
				type: 'tool_execution_end',
				toolCallId: 'tool-1',
				toolName: 'unity_status',
				result: {
					content: [{ type: 'text', text: 'Connected' }],
					details: { state: 'connected', instances: [{ port: 6400 }] },
				},
				isError: false,
			}),
		);
		pi.emit(piEvent({ type: 'agent_settled' }));

		expect(events.map((item) => item.type)).toEqual([
			'session.created',
			'session.state',
			'session.state',
			'message.started',
			'message.delta',
			'message.completed',
			'message.started',
			'message.delta',
			'message.completed',
			'session.usage',
			'tool.started',
			'tool.completed',
			'session.state',
		]);
		expect(events.find((item) => item.type === 'tool.completed')).toMatchObject(
			{
				result: { state: 'connected', instances: [{ port: 6400 }] },
				isError: false,
			},
		);
	});

	describe('resuming a streaming session', () => {
		it('splices the in-flight assistant message into the snapshot', async () => {
			const pi = new FakePiSession();
			const service = await createTestService(pi);
			const sessionId = await service.createSession();

			pi.isStreaming = true;
			pi.messages = [
				{ role: 'user', content: 'Inspect this', timestamp: 1 },
				{
					role: 'assistant',
					content: [
						{ type: 'thinking', thinking: 'Looking around' },
						{ type: 'text', text: 'Partial ans' },
					],
					timestamp: 2,
				},
			];
			// The translator mints the id later deltas will reference here.
			pi.emit(
				piEvent({
					type: 'message_start',
					message: { role: 'assistant', content: [], timestamp: 2 },
				}),
			);

			const snapshot = await service.resumeSession(sessionId);

			expect(snapshot.messages.at(-1)).toMatchObject({
				id: 'message-1',
				role: 'assistant',
				content: 'Partial ans',
				reasoning: 'Looking around',
				complete: false,
			});
		});

		it('includes the in-flight tool calls as running', async () => {
			const pi = new FakePiSession();
			const service = await createTestService(pi);
			const sessionId = await service.createSession();

			pi.isStreaming = true;
			pi.messages = [
				{
					role: 'assistant',
					content: [
						{
							type: 'toolCall',
							id: 'call-1',
							name: 'read',
							args: { path: 'README.md' },
						},
					],
					timestamp: 3,
				},
			];
			pi.emit(
				piEvent({
					type: 'message_start',
					message: { role: 'assistant', content: [], timestamp: 3 },
				}),
			);

			const snapshot = await service.resumeSession(sessionId);

			expect(snapshot.messages.at(-1)).toMatchObject({
				id: 'message-1',
				role: 'assistant',
				complete: false,
				tools: [{ id: 'call-1', name: 'read', status: 'running' }],
			});
		});

		it('splices nothing when the stream has no open assistant message', async () => {
			const pi = new FakePiSession();
			const service = await createTestService(pi);
			const sessionId = await service.createSession();

			pi.isStreaming = true;
			pi.messages = [
				{ role: 'user', content: 'Inspect this', timestamp: 1 },
				{ role: 'toolResult', toolCallId: 'call-1', content: [], timestamp: 2 },
			];

			const snapshot = await service.resumeSession(sessionId);

			expect(snapshot.messages).toHaveLength(0);
		});

		it('splices nothing once the session is no longer streaming', async () => {
			const pi = new FakePiSession();
			const service = await createTestService(pi);
			const sessionId = await service.createSession();

			pi.messages = [{ role: 'assistant', content: 'Done', timestamp: 1 }];

			const snapshot = await service.resumeSession(sessionId);

			expect(snapshot.messages).toHaveLength(0);
		});

		it('re-announces streaming state and sequences the snapshot against events', async () => {
			const pi = new FakePiSession();
			const service = await createTestService(pi);
			const sessionId = await service.createSession();

			pi.isStreaming = true;
			const events: AgentEvent[] = [];
			service.subscribe((agentEvent) => events.push(agentEvent));
			const snapshot = await service.resumeSession(sessionId);

			// A client that missed the original stream start (reload, reconnect,
			// first view) still learns the session is mid-response.
			const state = events.at(-1);
			expect(state).toMatchObject({
				type: 'session.state',
				state: 'streaming',
			});
			// Everything up to and including the pre-snapshot events is already
			// reflected in the snapshot; the state event is the first replayable.
			expect(snapshot.lastEventId).toBe(state!.eventId - 1);
		});
	});
});

describe('undelivered queued messages', () => {
	async function settle(pi: FakePiSession) {
		const service = await createTestService(pi);
		const events: AgentEvent[] = [];
		await service.createSession();
		service.subscribe((input) => events.push(parseAgentEvent(input)));
		pi.emit(piEvent({ type: 'agent_settled' }));
		return events;
	}

	/**
	 * A steered message rides along with the run in flight and is only handed to
	 * the model at the run's next call. A run that dies first — aborted, or
	 * dropped by the provider — never gets there, so the text has to come back.
	 */
	it('returns messages stranded by a run that died before delivering them', async () => {
		const pi = new FakePiSession();
		pi.queued = ['path'];

		const events = await settle(pi);

		expect(events).toContainEqual(
			expect.objectContaining({ type: 'session.unsent', messages: ['path'] }),
		);
	});

	it('says nothing when a run settles with an empty queue', async () => {
		const pi = new FakePiSession();

		const events = await settle(pi);

		expect(pi.clearQueue).not.toHaveBeenCalled();
		expect(events.some((event) => event.type === 'session.unsent')).toBe(false);
	});

	it('drops queued whitespace rather than restoring an empty composer', async () => {
		const pi = new FakePiSession();
		pi.queued = ['   '];

		const events = await settle(pi);

		expect(events.some((event) => event.type === 'session.unsent')).toBe(false);
	});
});
