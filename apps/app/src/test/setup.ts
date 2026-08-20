import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

class ResizeObserverMock implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

globalThis.ResizeObserver = ResizeObserverMock;
globalThis.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (handle) => window.clearTimeout(handle);

const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function () {
	const rect = getBoundingClientRect.call(this);
	if (this.dataset.ui !== 'scroll-viewport') return rect;
	return {
		...rect,
		bottom: 800,
		height: 800,
		right: 800,
		toJSON: () => ({}),
		width: 800,
	};
};

HTMLElement.prototype.scrollTo = function (
	optionsOrX?: ScrollToOptions | number,
	y?: number,
) {
	this.scrollTop =
		typeof optionsOrX === 'number'
			? (y ?? 0)
			: (optionsOrX?.top ?? this.scrollTop);
	this.dispatchEvent(new Event('scroll'));
};

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
	configurable: true,
	get() {
		if (this.dataset.ui === 'virtual-message') return 220;
		if (this.dataset.ui === 'console-row') return 76;
		return 0;
	},
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
	configurable: true,
	get() {
		return this.dataset.ui === 'scroll-viewport' ? 800 : 0;
	},
});

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
	configurable: true,
	get() {
		if (this.dataset.ui !== 'scroll-viewport') return 0;
		const canvas = this.querySelector(
			'[data-ui="virtual-canvas"]',
		) as HTMLElement | null;
		return Number.parseFloat(canvas?.style.height ?? '0');
	},
});

/*
 * Node exposes a `localStorage` global that is undefined unless the process was
 * started with --localstorage-file, and it shadows jsdom's. Install a minimal
 * in-memory Storage so persistence behaves the way it does in a browser.
 */
if (!globalThis.localStorage) {
	const entries = new Map<string, string>();
	const storage: Storage = {
		get length() {
			return entries.size;
		},
		key: (index) => [...entries.keys()][index] ?? null,
		getItem: (key) => entries.get(key) ?? null,
		setItem: (key, value) => void entries.set(key, String(value)),
		removeItem: (key) => void entries.delete(key),
		clear: () => entries.clear(),
	};
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: storage,
	});
}

/*
 * bits-ui restores the body scroll lock 24ms after a dialog unmounts. When a
 * test file ends before that timer fires, it runs against a torn-down jsdom and
 * throws `document is not defined`, failing the run while every test passes.
 * Waiting out the timer only when a lock is actually outstanding keeps that
 * cost off the tests that never opened a dialog.
 */
afterEach(async () => {
	cleanup();
	if (!document.body.getAttribute('style')?.includes('overflow')) return;
	await new Promise((resolve) => setTimeout(resolve, 30));
});
