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
});
