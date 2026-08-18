import { describe, expect, it } from 'vitest';
import { bottomTolerance, isAtBottom } from './follow';

describe('isAtBottom', () => {
	it('is true once the viewport reaches the end of the content', () => {
		expect(
			isAtBottom({ scrollHeight: 2711, scrollTop: 2067, clientHeight: 644 }),
		).toBe(true);
	});

	it('is false while the user is reading further up', () => {
		expect(
			isAtBottom({ scrollHeight: 2711, scrollTop: 1200, clientHeight: 644 }),
		).toBe(false);
	});

	/*
	 * Regression: the transcript used to end in 80px of bottom padding that the
	 * viewport could not scroll into, so the gap never fell below the threshold
	 * and the jump control showed even at the bottom.
	 */
	it('does not depend on a threshold larger than the trailing gap', () => {
		const unreachable = 80;
		expect(bottomTolerance).toBeLessThan(unreachable);
		expect(
			isAtBottom({
				scrollHeight: 2711,
				scrollTop: 2067 - unreachable,
				clientHeight: 644,
			}),
		).toBe(false);
	});
});
