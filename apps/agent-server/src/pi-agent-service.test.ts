import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { parseAgentEvent, type AgentEvent } from '@unity-agent/protocol';
import { describe, expect, it, vi } from 'vitest';
import { PiAgentService, type PiSessionLike } from './pi-agent-service';

class FakePiSession implements PiSessionLike {
	readonly sessionId: string;
	readonly prompt = vi.fn(async () => {});
	readonly steer = vi.fn(async () => {});
	readonly abort = vi.fn(async () => {});
	readonly dispose = vi.fn();
	#listener?: (event: AgentSessionEvent) => void;

	constructor(sessionId = 'pi-session-1') {
		this.sessionId = sessionId;
	}

	subscribe(listener: (event: AgentSessionEvent) => void) {
		this.#listener = listener;
		return () => (this.#listener = undefined);
	}

	emit(event: AgentSessionEvent) {
		this.#listener?.(event);
	}
}

function event(value: unknown): AgentSessionEvent {
	return value as AgentSessionEvent;
}

describe('PiAgentService', () => {
	it('routes commands into the Pi session', async () => {
		const pi = new FakePiSession();
		const service = new PiAgentService(async () => pi);
		const sessionId = await service.createSession({ cwd: '/projects/sandbox' });

		await service.prompt(sessionId, 'Inspect this');
		await service.steer(sessionId, 'Focus on the player');
		await service.abort(sessionId);
		service.dispose();

		expect(pi.prompt).toHaveBeenCalledWith('Inspect this');
		expect(pi.steer).toHaveBeenCalledWith('Focus on the player');
		expect(pi.abort).toHaveBeenCalledOnce();
		expect(pi.dispose).toHaveBeenCalledOnce();
	});

	it('translates Pi streaming and tool events into the shared protocol', async () => {
		const pi = new FakePiSession();
		const service = new PiAgentService(async () => pi);
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
		pi.emit(event({ type: 'agent_start' }));
		pi.emit(
			event({
				type: 'message_start',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(
			event({
				type: 'message_end',
				message: { role: 'user', content: 'Hello', timestamp: 1 },
			}),
		);
		pi.emit(event({ type: 'message_start', message: assistant }));
		pi.emit(
			event({
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
		pi.emit(event({ type: 'message_end', message: assistant }));
		pi.emit(
			event({
				type: 'tool_execution_start',
				toolCallId: 'tool-1',
				toolName: 'unity_status',
				args: {},
			}),
		);
		pi.emit(
			event({
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
		pi.emit(event({ type: 'agent_settled' }));

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
});
