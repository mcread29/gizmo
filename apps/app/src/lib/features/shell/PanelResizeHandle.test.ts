import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PanelResizeHandle from './PanelResizeHandle.svelte';

afterEach(cleanup);

describe('PanelResizeHandle', () => {
	it('supports precise keyboard resizing and reset', async () => {
		const onResize = vi.fn();
		const onReset = vi.fn();
		const { getByRole } = render(PanelResizeHandle, {
			side: 'left',
			size: 248,
			max: 420,
			onResize,
			onReset,
		});
		const handle = getByRole('slider', {
			name: 'Resize thread sidebar',
		});

		await fireEvent.keyDown(handle, { key: 'ArrowRight' });
		await fireEvent.keyDown(handle, { key: 'End' });
		await fireEvent.doubleClick(handle);

		expect(onResize).toHaveBeenNthCalledWith(1, 256);
		expect(onResize).toHaveBeenNthCalledWith(2, 420);
		expect(onReset).toHaveBeenCalledOnce();
	});

	it('reverses horizontal keyboard movement for the right panel', async () => {
		const onResize = vi.fn();
		const { getByRole } = render(PanelResizeHandle, {
			side: 'right',
			size: 288,
			max: 480,
			onResize,
			onReset: () => {},
		});

		await fireEvent.keyDown(
			getByRole('slider', { name: 'Resize editor inspector' }),
			{ key: 'ArrowRight' },
		);

		expect(onResize).toHaveBeenCalledWith(280);
	});

	it('commits pointer resizing once when the drag ends', async () => {
		const onResize = vi.fn();
		const { getByRole } = render(PanelResizeHandle, {
			side: 'left',
			size: 248,
			max: 420,
			onResize,
			onReset: () => {},
		});
		const handle = getByRole('slider', {
			name: 'Resize thread sidebar',
		});

		await fireEvent.pointerDown(handle, { button: 0, clientX: 200 });
		await fireEvent.pointerMove(window, { clientX: 240 });
		await fireEvent.pointerMove(window, { clientX: 260 });

		expect(onResize).not.toHaveBeenCalled();
		await fireEvent.pointerUp(window);
		expect(onResize).toHaveBeenCalledOnce();
		expect(onResize).toHaveBeenCalledWith(308);
	});
});
