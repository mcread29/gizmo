import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { GatedResumeClient } from './agent-store-gated-client';

describe('AgentStore', () => {
	it('ignores a stale resume after a newer session switch completes', async () => {
		const client = new GatedResumeClient();
		client.snapshot.session.workspacePath = '/projects/current';
		client.setSnapshot({
			session: {
				id: 'session-b',
				title: 'Second',
				workspacePath: '/projects/old',
				createdAt: 0,
				lastActiveAt: 0,
				messageCount: 0,
			},
			messages: [],
		});
		const store = new AgentStore(client);
		await store.connect();
		const { release } = client.gate('session-b');
		const staleSwitch = store.switchSession('session-b');

		await store.switchSession('session-a');
		release();
		await staleSwitch;

		expect(store.sessionId).toBe('session-a');
		expect(store.sessions[1]?.workspacePath).toBe('/projects/old');
		expect(store.selectedProjectPath).not.toBe('/projects/old');
	});

	it('replays mid-resume stream events exactly once when switching threads', async () => {
		const client = new GatedResumeClient();
		client.setSnapshot({
			session: {
				id: 'session-b',
				title: 'Second',
				createdAt: 0,
				lastActiveAt: 0,
				messageCount: 1,
			},
			// The server splices the in-flight partial message into the snapshot;
			// its content reflects everything streamed up to the snapshot point.
			messages: [
				{
					id: 'm1',
					role: 'assistant',
					content: 'Hel',
					createdAt: 0,
					complete: false,
					tools: [],
				},
			],
		});
		const store = new AgentStore(client);
		await store.connect();
		expect(store.sessionId).toBe('session-a');

		// Resume of the other thread is held mid-flight; deltas stream in while
		// it is outstanding.
		const { release } = client.gate('session-b');
		const switching = store.switchSession('session-b');
		// These two events are already reflected in the snapshot that will
		// arrive (its lastEventId covers them); replaying them would duplicate.
		client.emit('session-b', {
			type: 'message.started',
			messageId: 'm1',
			role: 'assistant',
			createdAt: 0,
		});
		client.emit('session-b', {
			type: 'message.delta',
			messageId: 'm1',
			delta: 'Hel',
		});
		client.snapshotFor('session-b').lastEventId = client.nextEventId - 1;
		// This one streams after the snapshot point and must be applied once.
		client.emit('session-b', {
			type: 'message.delta',
			messageId: 'm1',
			delta: 'lo',
		});
		client.emit('session-b', { type: 'session.state', state: 'streaming' });
		release();
		await switching;

		// 'Hel' is not duplicated and 'lo' is not lost: the view converges.
		expect(store.messages).toHaveLength(1);
		expect(store.messages[0]?.content).toBe('Hello');
		expect(store.sessionState).toBe('streaming');
	});
});
