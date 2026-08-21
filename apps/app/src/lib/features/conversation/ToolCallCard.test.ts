import type { ToolCallView } from '@gizmo/protocol';
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

	it('links structured compiler diagnostics to the project file', async () => {
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
		const { container, getByRole } = render(ToolCallCard, {
			tool,
			projectPath: '/projects/game',
		});
		await fireEvent.click(container.querySelector('summary')!);

		expect(
			getByRole('link', { name: 'Assets/Editor/Test.cs:12:4' }),
		).toHaveAttribute(
			'href',
			'vscode://file/projects/game/Assets/Editor/Test.cs:12:4',
		);
	});

	it('renders structured Unity test summaries and linked failures', async () => {
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
		const { container, getByRole, getByText } = render(ToolCallCard, {
			tool,
			projectPath: '/projects/game',
		});
		await fireEvent.click(container.querySelector('summary')!);

		expect(getByText('Game.PlayerTests.Jumps')).toBeInTheDocument();
		expect(
			getByRole('link', { name: 'Assets/Tests/PlayerTests.cs:42' }),
		).toHaveAttribute(
			'href',
			'vscode://file/projects/game/Assets/Tests/PlayerTests.cs:42',
		);
	});

	it('renders Unity TypeScript source, diagnostics, progress, and result', async () => {
		const tool: ToolCallView = {
			id: 'tool-script',
			name: 'unity_script',
			status: 'error',
			statusText: 'Failed',
			input: {
				code: 'const status = await unity.json(["status"]);\nreturn status;',
				timeoutSeconds: 20,
			},
			result: {
				ok: false,
				phase: 'typecheck',
				discoveredCommands: 12,
				logs: ['Discovering commands'],
				diagnostics: [
					{
						line: 1,
						column: 7,
						code: 2322,
						message: 'Type mismatch',
					},
				],
				error: 'TypeScript compilation failed',
			},
		};
		const { container, getByText, queryByText } = render(ToolCallCard, {
			tool,
		});
		await fireEvent.click(container.querySelector('summary')!);

		expect(getByText('Unity TypeScript')).toBeInTheDocument();
		expect(getByText(/TypeScript · const status/)).toBeInTheDocument();
		expect(getByText('Live commands')).toBeInTheDocument();
		expect(getByText('12')).toBeInTheDocument();
		expect(getByText('Type mismatch')).toBeInTheDocument();
		expect(getByText('Discovering commands')).toBeInTheDocument();
		expect(container.querySelector('.language-typescript')).not.toBeNull();
		expect(queryByText('code')).toBeNull();
	});
});
