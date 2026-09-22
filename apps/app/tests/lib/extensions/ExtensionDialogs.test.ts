import { render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import type { AgentStore } from '../../../src/lib/agent-client';
import { WorkspaceLayout } from '../../../src/lib/features/shell/workspace.svelte';
import ExtensionDialogs from '../../../src/lib/extensions/ExtensionDialogs.svelte';

it('shows extension-provided confirmation copy', async () => {
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
