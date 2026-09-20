import { fireEvent, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { renderApp, setupAppIntegrationTests } from '../support/app';

setupAppIntegrationTests();

/** Opens the workspace screen and switches to its Memory tab. */
async function openMemoryTab(
	findByRole: ReturnType<typeof renderApp>['findByRole'],
) {
	await findByRole('button', { name: 'Model' });
	await fireEvent.click(
		await findByRole('button', { name: 'ThirdPersonSandbox settings' }),
	);
	await findByRole('main', { name: 'Workspace' });
	await fireEvent.click(await findByRole('tab', { name: 'Memory' }));
}

/** The settings row a label belongs to, for scoping its own controls. */
function fieldOf(label: HTMLElement): HTMLElement {
	const field = label.closest('[data-ui="setting-field"]');
	if (!(field instanceof HTMLElement)) throw new Error('No setting field');
	return field;
}

/** The line under a setting's label, saying what it inherits or overrides. */
function detailOf(label: HTMLElement): string {
	const detail = fieldOf(label).querySelector('span')?.textContent ?? '';
	return detail.replace(/\s+/g, ' ').trim();
}

const overridesSection = '[data-ui="workspace-overrides"]';

/** The Overview row for one override, with its revert button. */
function rowOf(name: HTMLElement): HTMLElement {
	const row = name.closest('[data-ui="workspace-override-row"]');
	if (!(row instanceof HTMLElement)) throw new Error('No override row');
	return row;
}

describe('workspace memory', () => {
	it('reads one workspace memory from a tab beside Overview', async () => {
		const { findByRole, findByText } = renderApp();
		await openMemoryTab(findByRole);

		// Memory belongs to a workspace, so it sits with the workspace's other
		// tabs — directly after the overview it summarises. The inspector has
		// tabs of its own, so the screen's own tablist is what is read.
		const screen = await findByRole('main', { name: 'Workspace' });
		const tabs = within(screen).getAllByRole('tab');
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
			'Overview',
			'Memory',
			'Skills',
			'Extensions',
		]);
		expect(location.hash).toContain('/memory');

		// Both halves of the journal's derived layer are here: what still
		// stands, and the digests it was derived from.
		expect(
			await findByText(/The journal lives in .gizmo\/memory\/journal/),
		).toBeInTheDocument();
		expect(
			await findByText(/Made journal segment ids collision-safe/),
		).toBeInTheDocument();
	});

	it('filters saved memories without touching the standing facts', async () => {
		const { findByRole, findByText, queryByText } = renderApp();
		await openMemoryTab(findByRole);
		await findByText(/Made journal segment ids collision-safe/);

		await fireEvent.input(
			await findByRole('searchbox', { name: 'Filter memories' }),
			{
				target: { value: 'orphaned' },
			},
		);

		await waitFor(() =>
			expect(
				queryByText(/Made journal segment ids collision-safe/),
			).not.toBeInTheDocument(),
		);
		expect(
			await findByText(/Recovered six orphaned segments/),
		).toBeInTheDocument();
		// Facts are not part of the search; they describe the workspace, not
		// the transcript being filtered.
		expect(
			await findByText(/The journal lives in .gizmo\/memory\/journal/),
		).toBeInTheDocument();
	});

	it('turns digesting off for this workspace alone', async () => {
		const { findByRole, getByRole } = renderApp();
		await openMemoryTab(findByRole);
		// 491 segments, two of them digested, so the backfill has work to offer
		// until the workspace opts out of digesting entirely.
		const digest = await findByRole('button', { name: /Digest 489 segments/ });
		expect(digest).toBeEnabled();

		await fireEvent.change(getByRole('combobox', { name: 'Digest model' }), {
			target: { value: 'none' },
		});

		await waitFor(() =>
			expect(
				getByRole('button', { name: /Digest 489 segments/ }),
			).toBeDisabled(),
		);
		expect(getByRole('button', { name: 'Rebuild all' })).toBeDisabled();
	});

	it('inherits the machine-wide defaults until this workspace departs from them', async () => {
		const { findByRole, getByRole, getByText } = renderApp();
		await openMemoryTab(findByRole);
		// The default names a model, and this workspace has not said otherwise.
		await findByRole('combobox', { name: 'Digest model' });
		expect(detailOf(getByText('Digest model'))).toBe(
			'Inherits global · opencode-go · minimax-m3',
		);

		const field = fieldOf(getByText('Digest new segments automatically'));
		expect(detailOf(getByText('Digest new segments automatically'))).toBe(
			'Inherits global · on',
		);
		await fireEvent.click(
			within(field).getByRole('switch', {
				name: 'Digest new segments automatically',
			}),
		);

		// Overridden here alone: the model beside it still follows the global.
		await waitFor(() =>
			expect(detailOf(getByText('Digest new segments automatically'))).toBe(
				'Overridden · off',
			),
		);
		expect(detailOf(getByText('Digest model'))).toBe(
			'Inherits global · opencode-go · minimax-m3',
		);

		await fireEvent.click(
			within(field).getByRole('button', { name: 'Use global' }),
		);
		await waitFor(() =>
			expect(detailOf(getByText('Digest new segments automatically'))).toBe(
				'Inherits global · on',
			),
		);
	});

	it('lists what memory overrides on Overview, and reverts it from there', async () => {
		const { container, findByRole, getByRole, getByText } = renderApp();
		await openMemoryTab(findByRole);
		await findByRole('combobox', { name: 'Digest model' });

		await fireEvent.change(getByRole('combobox', { name: 'Digest model' }), {
			target: { value: 'none' },
		});
		await waitFor(() =>
			expect(detailOf(getByText('Digest model'))).toBe('Overridden · off'),
		);

		// Overview answers "what is different here?" for memory the same way it
		// does for a skill or an extension.
		await fireEvent.click(getByRole('tab', { name: 'Overview' }));
		const overrides = () =>
			within(container.querySelector<HTMLElement>(overridesSection)!);
		const row = await waitFor(() =>
			rowOf(overrides().getByText('Digest model')),
		);
		expect(row.textContent).toContain('Off here');
		expect(row.textContent).toContain('opencode-go · minimax-m3 globally');

		await fireEvent.click(
			within(row).getByRole('button', { name: 'Use global' }),
		);
		await waitFor(() =>
			expect(overrides().queryByText('Digest model')).not.toBeInTheDocument(),
		);
	});

	it('edits the machine-wide defaults from Settings', async () => {
		const { findByRole, getByRole, getByText } = renderApp();
		await findByRole('button', { name: 'Model' });
		await fireEvent.click(getByRole('button', { name: 'Settings' }));
		await findByRole('dialog', { name: 'Settings' });

		// Memory is a device setting again, alongside the credentials the digest
		// model needs; the workspace tab only overrides it.
		await fireEvent.click(getByRole('button', { name: 'Memory' }));
		expect(await findByRole('heading', { name: 'Memory' })).toBeInTheDocument();
		await fireEvent.click(
			getByRole('switch', { name: 'Digest new segments automatically' }),
		);
		await fireEvent.click(getByRole('button', { name: 'Back' }));

		// What the workspace inherits follows, because it never overrode it.
		await openMemoryTab(findByRole);
		await findByRole('combobox', { name: 'Digest model' });
		await waitFor(() =>
			expect(detailOf(getByText('Digest new segments automatically'))).toBe(
				'Inherits global · off',
			),
		);
	});
});
