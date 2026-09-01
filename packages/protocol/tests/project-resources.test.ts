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
				extensionId: 'unity',
			}),
		).toMatchObject({ type: 'project.watch', extensionId: 'unity' });
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-status',
				type: 'project.status',
				projectPath: '/projects/game',
				extensionId: 'unity',
			}),
		).toMatchObject({ type: 'project.status', extensionId: 'unity' });
		expect(
			parseAgentRequest({
				protocolVersion,
				requestId: 'request-open',
				type: 'project.open',
				projectPath: '/projects/game',
				extensionId: 'unity',
			}),
		).toMatchObject({ type: 'project.open', extensionId: 'unity' });
		// v25 compatibility: project requests without an extension id are
		// accepted (first-available routing) for one migration window.
		expect(
			parseAgentRequest({
				protocolVersion: 25,
				requestId: 'request-status-legacy',
				type: 'project.status',
				projectPath: '/projects/game',
			}),
		).toMatchObject({ type: 'project.status' });
		expect(() =>
			parseAgentRequest({
				// A v26 client may not omit the extension id.
				protocolVersion,
				requestId: 'request-status-missing-id',
				type: 'project.status',
				projectPath: '/projects/game',
			}),
		).toThrow(ProtocolValidationError);
		expect(
			parseAgentEvent({
				protocolVersion,
				eventId: 1,
				sessionId: 'session-1',
				type: 'project.status.changed',
				projectPath: '/projects/game',
				extensionId: 'unity',
				// Status payloads are opaque extension-owned data in core.
				status: { whatever: 'the extension sent', nested: [1, 2] },
			}),
		).toMatchObject({ type: 'project.status.changed', extensionId: 'unity' });
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
