import type { ToolCallView } from '@unity-agent/protocol';
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ToolCallCard from './ToolCallCard.svelte';

describe('ToolCallCard', () => {
	it('summarizes Unity Editor status without exposing raw JSON first', async () => {
		const tool: ToolCallView = {
			id: 'tool-1',
			name: 'unity_status',
			status: 'complete',
			statusText: 'Completed',
			result: {
				state: 'connected',
				instances: [
					{
						projectPath: '/projects/ThirdPersonSandbox',
						version: '6000.3.7f1',
						port: 6400,
					},
				],
				errors: [],
			},
		};
		const { container, getByText } = render(ToolCallCard, { tool });
		const details = container.querySelector('details');

		expect(details).not.toHaveAttribute('open');
		await fireEvent.click(getByText('Unity Editor status'));
		expect(details).toHaveAttribute('open');
		expect(getByText('/projects/ThirdPersonSandbox')).toBeInTheDocument();
		expect(getByText('Editors')).toBeInTheDocument();
	});

	it('links structured compiler diagnostics to the project file', () => {
		const tool: ToolCallView = {
			id: 'tool-2',
			name: 'unity_wait_for_command',
			status: 'error',
			statusText: 'Failed',
			result: {
				state: 'compile_failed',
				errors: [
					{
						code: 'CS1002',
						message: '; expected',
						file: 'Assets/Editor/Test.cs',
						line: 12,
						column: 4,
					},
				],
			},
		};
		const { getByRole } = render(ToolCallCard, {
			tool,
			projectPath: '/projects/game',
		});

		expect(
			getByRole('link', { name: 'Assets/Editor/Test.cs:12:4' }),
		).toHaveAttribute(
			'href',
			'vscode://file/projects/game/Assets/Editor/Test.cs:12:4',
		);
	});

	it('renders structured Unity test summaries and linked failures', () => {
		const tool: ToolCallView = {
			id: 'tool-tests',
			name: 'unity_test',
			status: 'error',
			statusText: 'Failed',
			result: {
				state: 'failed',
				summary: { total: 1, passed: 0, failed: 1 },
				tests: [
					{
						name: 'Game.PlayerTests.Jumps',
						status: 'Failed',
						message: 'Expected jump',
						file: 'Assets/Tests/PlayerTests.cs',
						line: 42,
					},
				],
				errors: [],
			},
		};
		const { getByRole, getByText } = render(ToolCallCard, {
			tool,
			projectPath: '/projects/game',
		});

		expect(getByText('Game.PlayerTests.Jumps')).toBeInTheDocument();
		expect(
			getByRole('link', { name: 'Assets/Tests/PlayerTests.cs:42' }),
		).toHaveAttribute(
			'href',
			'vscode://file/projects/game/Assets/Tests/PlayerTests.cs:42',
		);
	});
});
