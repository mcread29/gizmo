import { describe, expect, it, vi } from 'vitest';
import { AgentStore } from '../../../src/lib/agent-client/AgentStore.svelte.ts';
import { FakeAgentClient } from '../../../src/lib/agent-client/FakeAgentClient';

describe('AgentStore', () => {
	it('reloads extension activation without replacing the running session', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const store = new AgentStore(client);
		await store.connect();
		const sessionId = store.sessionId;

		await expect(store.reloadExtensions()).resolves.toEqual([]);

		expect(store.sessionId).toBe(sessionId);
		expect(store.connection).toBe('connected');
	});

	it('returns the opaque open result and tracks per-extension loading', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		vi.spyOn(client, 'openProject').mockResolvedValue({
			state: 'error',
			ok: false,
			command: ['unity', 'open', '/projects/ThirdPersonSandbox'],
			exitCode: 0,
			durationMs: 1,
			data: null,
			errors: [
				{
					code: 'UNITY_CLI_INVALID_JSON',
					message: 'Editor exited with code 1',
				},
			],
			warnings: [],
		});
		const store = new AgentStore(client);
		await store.connect();

		// The shell hands the raw result to the owning extension; Unity's web
		// extension owns validation and error reporting for its own payload.
		const openPromise = store.openProjectService('unity');
		expect(store.projectOpening.unity).toBe(true);
		await expect(openPromise).resolves.toMatchObject({
			state: 'error',
			ok: false,
		});
		expect(store.projectOpening.unity).toBe(false);
	});

	it('reloads the active sidebar when its extension override changes', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();

		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			false,
		);
		expect(store.enabledExtensionIds).not.toContain('svelte');

		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			true,
		);
		expect(store.enabledExtensionIds).toContain('svelte');
	});

	it('updates the workspace integrations when switching threads', async () => {
		const store = new AgentStore(new FakeAgentClient({ latencyMs: 0 }));
		await store.connect();
		await store.setProjectGizmoExtension(
			'/projects/ThirdPersonSandbox',
			'svelte',
			true,
		);
		const sandboxSession = store.sessionId!;

		await store.newSession('/projects/RenderingPlayground');
		expect(store.selectedProjectPath).toBe('/projects/RenderingPlayground');
		expect(store.enabledExtensionIds).not.toContain('svelte');

		await store.switchSession(sandboxSession);
		expect(store.selectedProjectPath).toBe('/projects/ThirdPersonSandbox');
		expect(store.enabledExtensionIds).toContain('svelte');
	});

	it('loads extensions for the active project', async () => {
		const client = new FakeAgentClient({ latencyMs: 0 });
		const listExtensions = vi
			.spyOn(client, 'listProjectExtensions')
			.mockImplementation(async (projectPath) => ({
				extensions: [
					{
						id: projectPath,
						name: 'Extension',
						version: '1.0.0',
						apiVersion: 1,
						capabilities: [],
						operations: [],
					},
				],
			}));
		const store = new AgentStore(client);

		await store.connect();

		expect(listExtensions).toHaveBeenLastCalledWith(
			'/projects/ThirdPersonSandbox',
		);
		expect(store.projectExtensions[0]?.id).toBe('/projects/ThirdPersonSandbox');

		await store.newSession('/projects/RenderingPlayground');

		expect(listExtensions).toHaveBeenLastCalledWith(
			'/projects/RenderingPlayground',
		);
		expect(store.projectExtensions[0]?.id).toBe(
			'/projects/RenderingPlayground',
		);
	});
});
