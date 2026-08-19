import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ConsoleExtensionRuntime } from './console-extension.svelte';
import type { ConsoleEntry } from './console-types';
import ConsolePanelHarness from './ConsolePanel.test.svelte';

describe('ConsolePanel', () => {
	it('keeps stack traces collapsed until requested', async () => {
		const runtime = stubRuntime({
			entries: [
				{
					seq: 1,
					level: 'error',
					message: 'Command failed',
					stackTrace: 'Long internal stack trace',
				},
			],
		});

		render(ConsolePanelHarness, { runtime });

		expect(screen.queryByText('Long internal stack trace')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Expand entry' }));
		expect(screen.getByText('Long internal stack trace')).toBeTruthy();
	});

	it('does not disable refresh for background polling', () => {
		const runtime = stubRuntime({ loading: true, manualRefreshing: false });
		const { container } = render(ConsolePanelHarness, { runtime });

		expect(
			container.querySelector<HTMLButtonElement>(
				'button[aria-label="Reload console"]',
			)?.disabled,
		).toBe(false);
	});

	it('filters console entries by severity', async () => {
		const runtime = stubRuntime({
			entries: [
				{ seq: 1, level: 'warn', message: 'A warning' },
				{ seq: 2, level: 'error', message: 'An error' },
			],
			counts: { logs: 0, warnings: 1, errors: 1 },
		});

		const { container } = render(ConsolePanelHarness, { runtime });
		const tab = (value: string) =>
			container.querySelector<HTMLButtonElement>(
				`[data-ui="tabs-trigger"][data-value="${value}"]`,
			)!;

		await fireEvent.click(tab('warn'));
		expect(screen.getByText('A warning')).toBeTruthy();
		expect(screen.queryByText('An error')).toBeNull();

		await fireEvent.click(tab('error'));
		expect(screen.queryByText('A warning')).toBeNull();
		expect(screen.getByText('An error')).toBeTruthy();
	});

	it('only mounts a viewport-sized window from a large console tail', () => {
		const consoleEntries: ConsoleEntry[] = Array.from(
			{ length: 500 },
			(_, index) => ({
				seq: index,
				level: 'log',
				message: `Console message ${index}`,
				timestamp: `2026-08-19T19:40:${String(index % 60).padStart(2, '0')}Z`,
			}),
		);
		const runtime = stubRuntime({
			entries: consoleEntries,
			counts: { logs: 500, warnings: 0, errors: 0 },
		});

		const { container } = render(ConsolePanelHarness, { runtime });

		expect(
			container.querySelectorAll('[data-ui="console-entry"]').length,
		).toBeLessThan(20);
		expect(
			Number.parseFloat(
				container.querySelector<HTMLElement>('[data-ui="console-canvas"]')!
					.style.height,
			),
		).toBeGreaterThan(30_000);
	});
});

function stubRuntime(
	overrides: Partial<ConsoleExtensionRuntime>,
): ConsoleExtensionRuntime {
	return {
		entries: [],
		counts: { logs: 0, warnings: 0, errors: 0 },
		loading: false,
		manualRefreshing: false,
		projectPath: '/projects/game',
		refresh: async () => {},
		clearLocal: () => {},
		...overrides,
	} as unknown as ConsoleExtensionRuntime;
}
