import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import type { AgentStore } from '../../../src/lib/agent-client';
import { WorkspaceLayout } from '../../../src/lib/features/shell/workspace.svelte';
import ExtensionDialogs from '../../../src/lib/extensions/ExtensionDialogs.svelte';

it.each([
	['stop', true],
	['keep_playing', false],
])('honors Unity compile policy %s', async (policy, accepted) => {
	const confirmation = {
		kind: 'stop_play_mode_for_compile',
		confirmationId: 'confirm',
		sessionId: 'thread',
	};
	const resolveConfirmation = vi.fn();
	const store = {
		pendingConfirmations: [confirmation],
		resolveConfirmation,
	} as unknown as AgentStore;
	const layout = new WorkspaceLayout();
	layout.extensionSettings = { unity: { compilePlayModePolicy: policy } };
	render(ExtensionDialogs, { store, layout });
	await waitFor(() =>
		expect(resolveConfirmation).toHaveBeenCalledWith(confirmation, accepted),
	);
	expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows extension-provided confirmation copy when the policy is ask', async () => {
	const store = {
		pendingConfirmations: [
			{
				kind: 'stop_play_mode_for_compile',
				title: 'Stop Unity Play Mode?',
				message: 'Compile the scripts.',
			},
		],
		resolveConfirmation: vi.fn(),
	} as unknown as AgentStore;
	render(ExtensionDialogs, { store, layout: new WorkspaceLayout() });
	expect(
		await screen.findByRole('dialog', { name: 'Stop Unity Play Mode?' }),
	).toBeInTheDocument();
	expect(screen.getByText('Compile the scripts.')).toBeInTheDocument();
	expect(store.resolveConfirmation).not.toHaveBeenCalled();
});
