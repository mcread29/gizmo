import { describe, expect, it, vi } from 'vitest';
import type { ExtensionUiResponse } from '@gizmo/protocol';
import { PiExtensionUiRuntime } from '../../src/sessions/pi-extension-ui-runtime';

describe('PiExtensionUiRuntime', () => {
	it('round-trips a selection through the browser response', async () => {
		const events: Array<
			Parameters<ConstructorParameters<typeof PiExtensionUiRuntime>[0]>[0]
		> = [];
		const runtime = new PiExtensionUiRuntime((event) => events.push(event));
		const result = runtime.context.select('Environment', ['dev', 'prod']);
		const event = events[0];
		expect(event?.type).toBe('extension.ui.requested');
		if (event?.type !== 'extension.ui.requested')
			throw new Error('missing request');

		runtime.resolve(event.runtimeId, event.uiRequestId, {
			kind: 'value',
			value: 'prod',
		});
		await expect(result).resolves.toBe('prod');
	});

	it('returns safe values when a runtime is cleared', async () => {
		const events: Array<{ type: string }> = [];
		const runtime = new PiExtensionUiRuntime((event) => events.push(event));
		const confirmation = runtime.context.confirm('Continue?', 'Run the task?');
		const input = runtime.context.input('Name');

		runtime.clear();

		await expect(confirmation).resolves.toBe(false);
		await expect(input).resolves.toBeUndefined();
		expect(events.at(-1)?.type).toBe('extension.ui.runtime.cleared');
	});

	it('honors dialog timeout and rejects an invalid selection', async () => {
		vi.useFakeTimers();
		const events: Array<{
			type: string;
			runtimeId?: string;
			uiRequestId?: string;
		}> = [];
		const runtime = new PiExtensionUiRuntime((event) => events.push(event));
		const selection = runtime.context.select('Choose', ['one'], {
			timeout: 50,
		});
		const request = events[0];
		expect(() =>
			runtime.resolve(request.runtimeId!, request.uiRequestId!, {
				kind: 'value',
				value: 'two',
			} satisfies ExtensionUiResponse),
		).toThrow('not one of the offered options');

		await vi.advanceTimersByTimeAsync(50);
		await expect(selection).resolves.toBeUndefined();
		vi.useRealTimers();
	});
});
