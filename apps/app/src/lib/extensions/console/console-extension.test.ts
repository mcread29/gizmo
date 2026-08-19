import { describe, expect, it, vi } from 'vitest';
import type { ExtensionContext } from '../types';
import { ConsoleExtensionRuntime } from './console-extension.svelte';

describe('ConsoleExtensionRuntime', () => {
	it('deduplicates polling and only marks a manual request busy', async () => {
		const pending: Array<(value: unknown) => void> = [];
		const invoke = vi.fn(
			() => new Promise<unknown>((resolve) => pending.push(resolve)),
		);
		const runtime = new ConsoleExtensionRuntime({
			projectPath: '/projects/game',
			invoke,
		} satisfies ExtensionContext);

		const background = runtime.refresh(true);
		expect(invoke).toHaveBeenCalledOnce();
		expect(runtime.manualRefreshing).toBe(false);
		pending.shift()?.(snapshot());
		await background;

		const manual = runtime.refresh(true);
		expect(invoke).toHaveBeenCalledTimes(2);
		expect(runtime.manualRefreshing).toBe(true);
		pending.shift()?.(snapshot());
		await manual;
		expect(runtime.manualRefreshing).toBe(false);

		runtime.dispose();
	});
});

function snapshot() {
	return {
		state: 'ready',
		counts: { logs: 0, warnings: 0, errors: 0 },
		entries: [],
	};
}
