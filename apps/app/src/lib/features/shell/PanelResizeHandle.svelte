<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		side: 'left' | 'right';
		size: number;
		min: number;
		max: number;
		onResize: (size: number) => void;
		onReset: () => void;
	}

	let { side, size, min, max, onResize, onReset }: Props = $props();
	let stopDragging: (() => void) | undefined;

	function clamp(value: number) {
		return Math.min(max, Math.max(min, Math.round(value)));
	}

	function beginDrag(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		stopDragging?.();
		const startX = event.clientX;
		const startSize = size;
		document.body.dataset.resizing = 'sidebar';

		const move = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientX - startX;
			onResize(clamp(startSize + (side === 'left' ? delta : -delta)));
		};
		const stop = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
			delete document.body.dataset.resizing;
			stopDragging = undefined;
		};
		stopDragging = stop;
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', stop, { once: true });
		window.addEventListener('pointercancel', stop, { once: true });
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

	onDestroy(() => stopDragging?.());
</script>

<div
	data-ui="panel-resize-handle"
	data-side={side}
	role="slider"
	tabindex="0"
	aria-label={`Resize ${side === 'left' ? 'thread sidebar' : 'editor inspector'}`}
	aria-orientation="horizontal"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={size}
	onpointerdown={beginDrag}
	onkeydown={handleKeydown}
	ondblclick={onReset}
></div>
