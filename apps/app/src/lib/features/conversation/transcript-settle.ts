/** Consecutive unchanged frames that count as "the transcript has settled". */
const settleFrames = 8;
const settleTimeout = 4_000;

export interface SettleTarget {
	viewport(): HTMLElement | null;
	totalSize(): number;
	count(): number;
	scrollToEnd(): void;
	/** Called once the size stops moving, with the viewport pinned. */
	onSettled(viewport: HTMLElement): void;
}

/**
 * Rows are measured only after they mount, so the total size keeps growing
 * for several frames after a thread opens. A single scrollToEnd() issued
 * against estimates lets the newest message drift out of view, leaving the
 * transcript on blank space. Re-pin until the size stops moving.
 */
export function createTranscriptSettle(target: SettleTarget) {
	let frame: number | undefined;

	function cancel() {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
	}

	function pin() {
		cancel();
		let previousSize = -1;
		let previousCount = -1;
		let stable = 0;
		// Switching threads replays the whole transcript, which arrives over many
		// frames, so the settle has to outlast the load rather than a fixed
		// handful of frames. It still gives up rather than spinning forever.
		const deadline = Date.now() + settleTimeout;
		const step = () => {
			frame = undefined;
			const node = target.viewport();
			if (!node) return;
			const size = target.totalSize();
			const count = target.count();
			target.scrollToEnd();
			stable =
				size === previousSize && count === previousCount ? stable + 1 : 0;
			previousSize = size;
			previousCount = count;
			if (stable >= settleFrames || Date.now() > deadline) {
				target.onSettled(node);
				return;
			}
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	}

	return {
		pin,
		cancel,
		get active() {
			return frame !== undefined;
		},
	};
}
