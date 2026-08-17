import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.svelte';

afterEach(cleanup);

describe('application shell', () => {
	it('renders the primary workspace regions', () => {
		const { getByRole } = render(App);

		expect(getByRole('main')).toBeInTheDocument();
		expect(
			getByRole('navigation', { name: 'Recent sessions' }),
		).toBeInTheDocument();
		expect(
			getByRole('complementary', { name: 'Unity Editor inspector' }),
		).toBeInTheDocument();
		expect(
			getByRole('textbox', { name: 'Message Unity Agent' }),
		).toBeInTheDocument();
	});

	it('has no detectable accessibility violations', async () => {
		const { container } = render(App);
		const results = await axe(container, {
			rules: { 'color-contrast': { enabled: false } },
		});

		expect(results.violations).toEqual([]);
	});

	it('exposes every design-system primitive in the component gallery', async () => {
		const { findByRole, getByRole, getByText } = render(App);

		await fireEvent.click(getByRole('button', { name: /components/i }));
		expect(
			await findByRole('dialog', { name: 'Interface components' }),
		).toBeInTheDocument();
		expect(getByText('Buttons')).toBeInTheDocument();
		expect(getByText('Menus and selection')).toBeInTheDocument();
		expect(getByText('Tabs and scrolling')).toBeInTheDocument();
		expect(getByText('Feedback')).toBeInTheDocument();
	});
});
