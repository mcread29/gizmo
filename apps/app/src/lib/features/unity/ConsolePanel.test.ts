import type { UnityConsoleEntry } from '@unity-agent/protocol';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { AgentStore } from '../../agent-client';
import ConsolePanelHarness from './ConsolePanel.test.svelte';

describe('ConsolePanel', () => {
	it('only mounts a viewport-sized window from a large console tail', () => {
		const consoleEntries: UnityConsoleEntry[] = Array.from(
			{ length: 500 },
			(_, index) => ({
				seq: index,
				level: 'log',
				message: `Console message ${index}`,
				timestamp: `2026-08-19T19:40:${String(index % 60).padStart(2, '0')}Z`,
			}),
		);
		const store = {
			consoleEntries,
			consoleLoading: false,
			loadConsole: async () => {},
			clearConsole: () => {},
		} as unknown as AgentStore;

		const { container } = render(ConsolePanelHarness, { store });

		expect(container.querySelectorAll('[data-ui="console-entry"]').length).toBeLessThan(
			20,
		);
		expect(
			Number.parseFloat(
				container.querySelector<HTMLElement>('[data-ui="console-canvas"]')!
					.style.height,
			),
		).toBeGreaterThan(30_000);
	});
});
