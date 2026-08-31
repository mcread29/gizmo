import { parseAgentEvent, type AgentEvent } from '@gizmo/protocol';
import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';

describe('FakeAgentClient', () => {
	it('streams messages and tool activity through the store', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		await store.prompt('Inspect the Editor');

		expect(store.messages).toHaveLength(2);
		expect(store.messages[0]).toMatchObject({
			role: 'user',
			content: 'Inspect the Editor',
		});
		expect(store.messages[1].content).toContain('connected and ready');
		expect(store.messages[1].tools[0]).toMatchObject({
			name: 'unity_status',
			status: 'complete',
		});
		expect(store.sessionState).toBe('idle');
	});

	it('isolates events by session', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const events: AgentEvent[] = [];
		client.subscribe((input) => events.push(parseAgentEvent(input)));
		await client.connect();
		const first = await client.createSession();
		const second = await client.createSession();
		await client.prompt(first, 'First session only');

		const secondEvents = events.filter((event) => event.sessionId === second);
		expect(secondEvents.map((event) => event.type)).toEqual([
			'session.created',
			'session.state',
		]);
	});

	it('stops an active response without leaving the session busy', async () => {
		const client = new FakeAgentClient({ latencyMs: 50 });
		const events: AgentEvent[] = [];
		client.subscribe((input) => events.push(parseAgentEvent(input)));
		await client.connect();
		const sessionId = await client.createSession();
		const prompt = client.prompt(sessionId, 'A long request');
		await client.abort(sessionId);
		await prompt;

		expect(events.some((event) => event.type === 'tool.started')).toBe(false);
		expect(events.at(-1)).toMatchObject({
			type: 'session.state',
			state: 'idle',
		});
	});
});
