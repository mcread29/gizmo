import type { ToolCallView, UnityStatus } from '@unity-agent/protocol';
import { describe, expect, it } from 'vitest';
import { createUnityView } from './unity-view';

describe('createUnityView lifecycle', () => {
	it('shows live compilation progress from the reload tool', () => {
		const view = viewFor({
			id: 'tool-1',
			name: 'unity_wait_for_command',
			status: 'running',
			statusText: 'Unity compilation: compiling',
		});

		expect(view.lifecycle).toMatchObject({
			state: 'compiling',
			label: 'Compiling scripts',
		});
	});

	it('keeps compiler errors and their locations visible after failure', () => {
		const view = viewFor({
			id: 'tool-1',
			name: 'unity_wait_for_command',
			status: 'error',
			statusText: 'Failed',
			result: {
				state: 'compile_failed',
				errors: [
					{
						code: 'CS1002',
						message: 'Assets/Foo.cs(2,3): error CS1002: ; expected',
					},
				],
			},
		});

		expect(view.lifecycle.state).toBe('failed');
		expect(view.lifecycle.errors[0]).toMatchObject({
			file: 'Assets/Foo.cs',
			line: 2,
			column: 3,
		});
	});
});

function viewFor(tool: ToolCallView) {
	return createUnityView({
		messages: [
			{
				id: 'message-1',
				role: 'assistant',
				content: '',
				createdAt: 1,
				complete: true,
				tools: [tool],
			},
		],
		projects: [],
		projectStatus: connectedStatus,
		projectsLoading: false,
	});
}

const connectedStatus: UnityStatus = {
	state: 'connected',
	ok: true,
	command: ['unity', 'status'],
	exitCode: 0,
	durationMs: 1,
	instances: [],
	errors: [],
	warnings: [],
};
