import type { AgentEvent } from '@gizmo/protocol';
import { describe, expect, it, vi } from 'vitest';
import { registerExtensions } from '../../src/extensions/registry';
import { ProjectCatalog } from '../../src/projects/project-catalog';
import { PiAgentService } from '../../src/sessions/pi-agent-service';
import { PiSessionRepository } from '../../src/sessions/session-repository';
import {
	createTemporaryDirectory,
	FakePiSession,
} from './support/pi-agent-service-fixtures';

describe('PiAgentService session creation', () => {
	it('resolves extension activation from the global state and workspace overrides', async () => {
		const dataDir = await createTemporaryDirectory('gizmo-profile-policy-');
		const projectPath = await createTemporaryDirectory('gizmo-project-');
		registerExtensions([
			{
				id: 'notes',
				name: 'Notes',
				systemPrompt: 'Notes guidance.',
				createTools: () => [
					{
						name: 'notes_tool',
						label: 'Notes tool',
						description: 'A notes tool.',
						parameters: { type: 'object', properties: {} },
						execute: () =>
							Promise.resolve({
								output: 'ok',
								content: [],
								details: undefined,
							}),
					},
				],
			},
		]);
		const projects = new ProjectCatalog(dataDir);
		await projects.add(projectPath);
		const options: Array<{ integrations?: { id: string }[] }> = [];
		const service = new PiAgentService(
			async (runtimeOptions, manager) => {
				options.push(runtimeOptions);
				return new FakePiSession(manager.getSessionId());
			},
			new PiSessionRepository(dataDir),
			projects,
		);

		// The workspace inherits the global state, so the extension is active.
		await service.createSession({ cwd: projectPath });
		expect(options.at(-1)).toMatchObject({
			integrations: [{ id: 'notes', root: '.' }],
		});

		// Disabling the extension for the workspace removes it from new sessions.
		await projects.setGizmoExtension(projectPath, 'notes', false);
		await service.createSession({ cwd: projectPath });
		expect(options.at(-1)).toMatchObject({ integrations: [] });
		service.dispose();
		registerExtensions([]);
	});

	it('blocks a Unity compile until the app resolves its confirmation', async () => {
		const dataDir = await createTemporaryDirectory();
		const pi = new FakePiSession();
		let requestConfirmation!: (projectPath: string) => Promise<boolean>;
		const service = new PiAgentService(async (_options, manager, callbacks) => {
			pi.sessionId = manager.getSessionId();
			requestConfirmation = callbacks.confirmStopPlayMode;
			return pi;
		}, new PiSessionRepository(dataDir));
		const events: AgentEvent[] = [];
		service.subscribe((agentEvent) => events.push(agentEvent));
		const sessionId = await service.createSession({ cwd: '/projects/game' });

		const decision = requestConfirmation('/projects/game');
		const confirmation = events.find(
			(agentEvent) => agentEvent.type === 'confirmation.requested',
		);
		expect(confirmation).toMatchObject({
			type: 'confirmation.requested',
			sessionId,
			kind: 'stop_play_mode_for_compile',
		});
		service.resolveConfirmation(sessionId, confirmation!.confirmationId, true);
		await expect(decision).resolves.toBe(true);
	});

	it('accepts a browser UI response while a session is still starting', async () => {
		const dataDir = await createTemporaryDirectory('gizmo-extension-ui-test-');
		const pi = new FakePiSession();
		let decision: boolean | undefined;
		const service = new PiAgentService(async (_options, manager, callbacks) => {
			pi.sessionId = manager.getSessionId();
			decision = await callbacks.extensionUi.context.confirm(
				'Trust helper?',
				'Allow this extension to continue?',
			);
			return pi;
		}, new PiSessionRepository(dataDir));
		const events: AgentEvent[] = [];
		service.subscribe((agentEvent) => events.push(agentEvent));

		const creation = service.createSession({ cwd: '/projects/game' });
		await vi.waitFor(() =>
			expect(
				events.some(
					(agentEvent) => agentEvent.type === 'extension.ui.requested',
				),
			).toBe(true),
		);
		const request = events.find(
			(agentEvent) => agentEvent.type === 'extension.ui.requested',
		);
		if (request?.type !== 'extension.ui.requested')
			throw new Error('missing UI');
		await service.resolveExtensionUi(
			request.sessionId,
			request.runtimeId,
			request.uiRequestId,
			{ kind: 'confirmed', confirmed: true },
		);

		await creation;
		expect(decision).toBe(true);
	});

	it('does not leave a persisted session when Pi creation fails', async () => {
		const dataDir = await createTemporaryDirectory();
		const repository = new PiSessionRepository(dataDir);
		const service = new PiAgentService(async () => {
			throw new Error('No model available');
		}, repository);

		await expect(
			service.createSession({ cwd: '/projects/game' }),
		).rejects.toThrow('No model available');
		expect((await repository.list()).sessions).toEqual([]);
	});
});
