import { describe, expect, it } from 'vitest';
import {
	edgeWidth,
	swipeAction,
} from '../../../../src/lib/features/shell/drawer-swipe';

const closed = {
	leftMode: 'overlay',
	rightMode: 'overlay',
	leftDrawerOpen: false,
	rightDrawerOpen: false,
} as const;

describe('swipeAction', () => {
	it('opens the sidebar from the left edge and the inspector from the right', () => {
		expect(swipeAction(60, 4, 10, 390, closed)).toBe('open-left');
		expect(swipeAction(-60, 4, 385, 390, closed)).toBe('open-right');
	});

	it('waits for enough travel and gives up on a vertical scroll', () => {
		expect(swipeAction(20, 2, 10, 390, closed)).toBeUndefined();
		expect(swipeAction(10, 40, 10, 390, closed)).toBe('abandon');
	});

	it('ignores swipes that start away from an edge', () => {
		expect(swipeAction(80, 0, edgeWidth + 1, 390, closed)).toBe('abandon');
	});

	it('closes an open drawer with a swipe back towards its edge', () => {
		const leftOpen = { ...closed, leftDrawerOpen: true };
		expect(swipeAction(-60, 0, 200, 390, leftOpen)).toBe('close');
		expect(swipeAction(60, 0, 200, 390, leftOpen)).toBe('abandon');
		const rightOpen = { ...closed, rightDrawerOpen: true };
		expect(swipeAction(60, 0, 200, 390, rightOpen)).toBe('close');
	});

	it('does nothing where the panels are docked', () => {
		expect(
			swipeAction(60, 0, 10, 1400, { ...closed, leftMode: 'docked' }),
		).toBe('abandon');
	});
});
