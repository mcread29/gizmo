import { describe, expect, it } from 'vitest';
import {
	keyboardInset,
	watchKeyboardInset,
} from '../../../../src/lib/features/shell/keyboard-inset';

describe('keyboardInset', () => {
	it('is the height the visual viewport lost to the keyboard', () => {
		expect(keyboardInset({ height: 500, offsetTop: 0 }, 844)).toBe(344);
	});

	it('counts the part scrolled off the top as covered too', () => {
		expect(keyboardInset({ height: 500, offsetTop: 44 }, 844)).toBe(300);
	});

	it('ignores browser chrome jitter', () => {
		expect(keyboardInset({ height: 760, offsetTop: 0 }, 844)).toBe(0);
	});
});

describe('watchKeyboardInset', () => {
	it('publishes the inset as a root custom property until stopped', () => {
		const listeners = new Map<string, () => void>();
		const viewport = {
			height: 500,
			offsetTop: 0,
			addEventListener: (type: string, listener: () => void) =>
				listeners.set(type, listener),
			removeEventListener: (type: string) => listeners.delete(type),
		} as unknown as VisualViewport;
		const root = document.createElement('div');
		const stop = watchKeyboardInset(viewport, root, () => 844);
		expect(root.style.getPropertyValue('--keyboard-inset')).toBe('344px');

		Object.defineProperty(viewport, 'height', { value: 844 });
		listeners.get('resize')?.();
		expect(root.style.getPropertyValue('--keyboard-inset')).toBe('0px');

		stop();
		expect(root.style.getPropertyValue('--keyboard-inset')).toBe('');
		expect(listeners.size).toBe(0);
	});

	it('is a no-op without a visual viewport', () => {
		expect(() => watchKeyboardInset(null, undefined)()).not.toThrow();
	});
});
