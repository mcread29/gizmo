import { parseAgentEvent, type AgentEvent } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import {
	createTestService,
	FakePiSession,
	piEvent,
} from './support/pi-agent-service-fixtures';

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
