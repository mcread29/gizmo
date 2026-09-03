import { describe, expect, it, vi } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { GatedResumeClient } from './agent-store-gated-client';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function clientWithReply() {
	const client = new GatedResumeClient();
	client.snapshot.messages = [
		{
			id: 'm1',
			role: 'assistant',
			content: 'Yes — it is live now.',
			createdAt: 0,
			complete: true,
			tools: [],
		},
	];
	client.snapshot.state = 'idle';
	return client;
}

describe('AgentStore resync', () => {
	it('takes the run state from the snapshot, not the last event heard', async () => {
		const client = new GatedResumeClient();
		client.snapshot.state = 'streaming';
		const store = new AgentStore(client);
		await store.connect();

		expect(store.sessionState).toBe('streaming');
		expect(store.isSessionStreaming('session-a')).toBe(true);
	});

	it('re-reads the thread when event ids skip', async () => {
		const client = clientWithReply();
		const store = new AgentStore(client);
		await store.connect();
		const resume = vi.spyOn(client, 'resumeSession');
		// The client's copy went stale: it still believes the run is going.
		client.emit('session-a', { type: 'session.state', state: 'streaming' });
		expect(store.sessionState).toBe('streaming');

		client.dropEvents(3);
		client.emit('session-a', { type: 'session.usage', usage: usage() });
		await flush();

		expect(resume).toHaveBeenCalledWith('session-a');
		expect(store.sessionState).toBe('idle');
		expect(store.messages.map(({ content }) => content)).toEqual([
			'Yes — it is live now.',
		]);
	});

	it('re-reads the thread when a heartbeat names an unseen event', async () => {
		const client = clientWithReply();
		const store = new AgentStore(client);
		await store.connect();
		client.emit('session-a', { type: 'session.state', state: 'streaming' });
		const resume = vi.spyOn(client, 'resumeSession');

		client.heartbeat();
		await flush();
		expect(resume).not.toHaveBeenCalled();

		client.heartbeat(client.nextEventId + 5);
		await flush();
		expect(resume).toHaveBeenCalledTimes(1);
		expect(store.sessionState).toBe('idle');
	});

	it('keeps events that arrive during the re-read', async () => {
		const client = clientWithReply();
		const store = new AgentStore(client);
		await store.connect();
		// Gap detection needs a first id to count from.
		client.emit('session-a', { type: 'session.state', state: 'idle' });
		const { release } = client.gate('session-a');

		client.dropEvents(1);
		client.emit('session-a', { type: 'session.state', state: 'streaming' });
		await flush();
		// Snapshot is current as of everything emitted so far; the next event
		// is news the snapshot cannot know about.
		client.snapshot.lastEventId = client.nextEventId - 1;
		client.emit('session-a', {
			type: 'message.started',
			messageId: 'm2',
			role: 'assistant',
			createdAt: 1,
		});
		release();
		await flush();

		expect(store.messages.map(({ id }) => id)).toEqual(['m1', 'm2']);
	});

	it('does not disturb what is on screen while re-reading', async () => {
		const client = clientWithReply();
		const store = new AgentStore(client);
		await store.connect();
		// Gap detection needs a first id to count from.
		client.emit('session-a', { type: 'session.state', state: 'idle' });
		const { release } = client.gate('session-a');

		client.dropEvents(1);
		client.emit('session-a', { type: 'session.state', state: 'streaming' });
		await flush();
		expect(store.messagesLoading).toBe(false);
		expect(store.messages).toHaveLength(1);
		expect(store.sessionId).toBe('session-a');
		release();
		await flush();
	});

	it('seeds sidebar run states from the catalog on connect', async () => {
		const client = new GatedResumeClient();
		client.snapshot.session.state = 'streaming';
		const store = new AgentStore(client);
		await store.connect();

		expect(store.isSessionStreaming('session-a')).toBe(true);
	});

	it('applies project events regardless of which session sent them', async () => {
		const client = clientWithReply();
		client.snapshot.session.workspacePath = '/projects/current';
		const store = new AgentStore(client);
		await store.connect();
		expect(store.selectedProjectPath).toBe('/projects/current');

		client.emit('some-other-session', {
			type: 'project.extensions.changed',
			projectPath: '/projects/current',
			extensions: [
				{
					id: 'codex',
					name: 'Codex',
					version: '1.0.0',
					apiVersion: 1,
					capabilities: [],
					operations: [],
				},
			],
		});

		expect(store.projectExtensions.map(({ id }) => id)).toEqual(['codex']);
	});

	it('closes a socket that falls silent after heartbeats began', async () => {
		vi.useFakeTimers();
		try {
			const client = clientWithReply();
			const disconnect = vi.spyOn(client, 'disconnect');
			const store = new AgentStore(client);
			await store.connect();

			// No heartbeat yet: a server that sends none is never timed out.
			await vi.advanceTimersByTimeAsync(120_000);
			expect(disconnect).not.toHaveBeenCalled();

			client.heartbeat();
			await vi.advanceTimersByTimeAsync(30_000);
			expect(disconnect).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(30_000);
			expect(disconnect).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

function usage() {
	return {
		input: 1,
		output: 1,
		cacheRead: 0,
		cacheWrite: 0,
		contextUsed: 2,
		cost: 0,
	};
}
