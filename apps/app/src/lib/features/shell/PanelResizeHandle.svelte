<script lang="ts">
	import { onDestroy } from 'svelte';
	import { panelWidthLimits, type PanelName } from '../../app-settings';

	interface Props {
		side: 'left' | 'right';
		size: number;
		max: number;
		onResize: (size: number) => void;
		onReset: () => void;
	}

	let { side, size, max, onResize, onReset }: Props = $props();
	let removeDragListeners: (() => void) | undefined;
	let resizeFrame: number | undefined;
	let previewSize: number | undefined;
	let handle: HTMLElement | undefined;
	let dragStartSize = 0;
	let panel: PanelName = $derived(side === 'left' ? 'sidebar' : 'inspector');
	let min = $derived(panelWidthLimits[panel].min);
	let label = $derived(side === 'left' ? 'thread sidebar' : 'editor inspector');

	function clamp(value: number) {
		return Math.min(max, Math.max(min, Math.round(value)));
	}

	function beginDrag(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		finishDrag(false);
		const startX = event.clientX;
		dragStartSize = size;
		handle = event.currentTarget as HTMLElement;
		document.body.dataset.resizing = 'sidebar';

		const move = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientX - startX;
			queuePreview(clamp(dragStartSize + (side === 'left' ? delta : -delta)));
		};
		const stop = () => finishDrag(true);
		removeDragListeners = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', stop, { once: true });
		window.addEventListener('pointercancel', stop, { once: true });
	}

	function queuePreview(nextSize: number) {
		if (nextSize === previewSize) return;
		previewSize = nextSize;
		if (resizeFrame !== undefined) return;
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = undefined;
			applyPreview();
		});
	}

	function applyPreview() {
		if (previewSize === undefined) return;
		const offset =
			side === 'left'
				? previewSize - dragStartSize
				: dragStartSize - previewSize;
		handle?.style.setProperty('transform', `translate3d(${offset}px, 0, 0)`);
	}

	function finishDrag(commit: boolean) {
		removeDragListeners?.();
		removeDragListeners = undefined;
		if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
		resizeFrame = undefined;
		if (commit && previewSize !== undefined) {
			if (previewSize !== size) onResize(previewSize);
		}
		handle?.style.removeProperty('transform');
		previewSize = undefined;
		handle = undefined;
		delete document.body.dataset.resizing;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Home') {
			event.preventDefault();
			onResize(min);
			return;
		}
		if (event.key === 'End') {
			event.preventDefault();
			onResize(max);
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const screenDelta = event.key === 'ArrowRight' ? 8 : -8;
		onResize(clamp(size + (side === 'left' ? screenDelta : -screenDelta)));
	}

	onDestroy(() => finishDrag(false));
</script>

<div
	data-ui="panel-resize-handle"
	data-side={side}
	role="slider"
	tabindex="0"
	aria-label={`Resize ${label}`}
	aria-orientation="horizontal"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={size}
	aria-valuetext={`${size} pixels`}
	onpointerdown={beginDrag}
	onkeydown={handleKeydown}
	ondblclick={onReset}
></div>
