import '@testing-library/jest-dom/vitest';

class ResizeObserverMock implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

globalThis.ResizeObserver = ResizeObserverMock;
globalThis.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (handle) => window.clearTimeout(handle);

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
