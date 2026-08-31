import { describe, expect, it } from 'vitest';
import {
	parseAgentEvent,
	parseAgentRequest,
	parseResourceCatalog,
	parseStoredProjects,
	protocolVersion,
	ProtocolValidationError,
} from '../src/index';

describe('project and resource protocol validation', () => {
	it('accepts opaque extension operations through the generic project boundary', () => {
		const request = parseAgentRequest({
			protocolVersion,
			requestId: 'request-extension',
			type: 'project.extension.invoke',
			projectPath: '/projects/game',
			extensionId: 'com.gizmo.extras.console',
			operation: 'snapshot',
			input: { tail: 20 },
		});

		expect(request.type).toBe('project.extension.invoke');
	});

	it('validates stored projects with their selected integrations', () => {
		expect(
			parseStoredProjects([
				{
					title: 'Game',
					path: '/projects/game',
					integrations: [{ id: 'unity', root: '.' }],
					addedAt: 1,
				},
			]),
		).toHaveLength(1);
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'detect-1',
				type: 'project.detect',
				projectPath: '/projects/game',
			}),
		).toMatchObject({ type: 'project.detect' });
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'browse-1',
				type: 'project.browse',
				path: '/projects',
			}),
		).toMatchObject({ type: 'project.browse', path: '/projects' });
	});

	it('validates project status subscriptions and change events', () => {
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-watch',
				type: 'project.watch',
				sessionId: 'session-1',
				projectPath: '/projects/game',
			}),
		).toMatchObject({ type: 'project.watch' });
		expect(
			parseAgentEvent({
				protocolVersion,
				eventId: 1,
				sessionId: 'session-1',
				type: 'project.status.changed',
				projectPath: '/projects/game',
				status: {
					state: 'disconnected',
					ok: true,
					command: ['unity', 'status'],
					exitCode: 0,
					durationMs: 1,
					instances: [],
					errors: [],
					warnings: [],
				},
			}),
		).toMatchObject({ type: 'project.status.changed' });
	});

	it('validates resource requests and the returned catalog', () => {
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-1',
				type: 'resources.skill.project',
				workspacePath: '/projects/game',
				skillId: 'global/review',
				enabled: null,
			}),
		).toMatchObject({ enabled: null });

		expect(() =>
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-1',
				type: 'resources.skill.project',
				workspacePath: '/projects/game',
				skillId: 'global/review',
			}),
		).toThrow(ProtocolValidationError);

		expect(
			parseResourceCatalog({
				workspacePath: '/projects/game',
				skills: [
					{
						id: 'global/review',
						name: 'review',
						description: 'Review changes',
						scope: 'global',
						path: '/skills/review/SKILL.md',
						source: 'user',
						installed: true,
						enabledGlobally: false,
						enabled: true,
						override: true,
					},
				],
				agentsFiles: [],
				prompts: [],
				diagnostics: [],
			}).skills,
		).toHaveLength(1);

		expect(() =>
			parseResourceCatalog({ skills: [], agentsFiles: [], prompts: [] }),
		).toThrow(ProtocolValidationError);
	});
});
