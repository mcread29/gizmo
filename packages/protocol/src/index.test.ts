import { describe, expect, it } from 'vitest';
import {
	agentToolPolicy,
	parseAgentEvent,
	parseAgentRequest,
	parseAgentResponse,
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

	it('rejects unknown and incompatible events', () => {
		expect(() =>
			parseAgentEvent({
				protocolVersion: 3,
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
