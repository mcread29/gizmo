import { describe, expect, it } from 'vitest';
import {
	agentToolPolicy,
	parseAgentModelCatalog,
	parseAgentEvent,
	parseAgentRequest,
	parseAgentResponse,
	parseSessionCatalog,
	parseSessionSnapshot,
	protocolVersion,
	ProtocolValidationError,
} from './index';

describe('agent protocol validation', () => {
	it('defines the harness-owned full-access tool boundary', () => {
		expect(agentToolPolicy).toEqual({
			tools: [
				'read',
				'edit',
				'write',
				'unity_status',
				'unity_list_commands',
				'unity_command',
			],
			approvals: false,
			extensions: false,
		});
		expect(agentToolPolicy.tools).not.toContain('bash');
	});

	it('accepts a valid prompt request', () => {
		const request = parseAgentRequest({
			protocolVersion,
			requestId: 'request-1',
			type: 'session.prompt',
			sessionId: 'session-1',
			text: 'Inspect the active scene',
		});

		expect(request.type).toBe('session.prompt');
	});

	it('validates model catalogs and model-selection requests', () => {
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-model',
				type: 'model.select',
				sessionId: 'session-1',
				provider: 'openai-codex',
				modelId: 'gpt-5.6-sol',
			}),
		).toMatchObject({ type: 'model.select', modelId: 'gpt-5.6-sol' });
		expect(
			parseAgentModelCatalog({
				current: {
					provider: 'openai-codex',
					id: 'gpt-5.6-sol',
					thinkingLevel: 'high',
				},
				models: [
					{
						provider: 'openai-codex',
						id: 'gpt-5.6-sol',
						name: 'GPT-5.6 Sol',
						reasoning: true,
					},
				],
				thinkingLevels: ['low', 'high'],
			}),
		).toMatchObject({ current: { thinkingLevel: 'high' } });
	});

	it('correlates successful and failed transport responses', () => {
		expect(
			parseAgentResponse({
				protocolVersion,
				requestId: 'request-1',
				type: 'response.success',
				sessionId: 'session-1',
			}),
		).toMatchObject({ requestId: 'request-1', sessionId: 'session-1' });

		expect(
			parseAgentResponse({
				protocolVersion,
				requestId: 'request-2',
				type: 'response.error',
				code: 'request_failed',
				message: 'Prompt failed',
			}),
		).toMatchObject({ requestId: 'request-2', code: 'request_failed' });
	});

	it('validates durable session catalogs and hydrated transcripts', () => {
		const session = {
			id: 'session-1',
			title: 'Scene inspection',
			projectPath: '/projects/game',
			createdAt: 1,
			lastActiveAt: 2,
			messageCount: 1,
		};
		expect(
			parseSessionCatalog({ sessions: [session], lastSessionId: 'session-1' }),
		).toMatchObject({ lastSessionId: 'session-1' });
		expect(
			parseSessionSnapshot({
				session,
				messages: [
					{
						id: 'message-1',
						role: 'user',
						content: 'Inspect the scene',
						createdAt: 1,
						complete: true,
						tools: [],
					},
				],
			}),
		).toMatchObject({ session, messages: [{ role: 'user' }] });
	});

	it('rejects unknown and incompatible events', () => {
		expect(() =>
			parseAgentEvent({
				protocolVersion: protocolVersion + 1,
				eventId: 1,
				sessionId: 'session-1',
				type: 'message.delta',
				messageId: 'message-1',
				delta: 'hello',
			}),
		).toThrow(ProtocolValidationError);

		expect(() =>
			parseAgentEvent({
				protocolVersion,
				eventId: 1,
				sessionId: 'session-1',
				type: 'unknown.event',
			}),
		).toThrow(ProtocolValidationError);
	});
});
