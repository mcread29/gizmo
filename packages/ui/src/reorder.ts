/** Which side of a drop target the pointer is on. */
export type DropEdge = 'before' | 'after';

/** Reads the drop edge from the pointer position within the target element. */
export function dropEdge(
	event: { clientX: number; clientY: number },
	target: Element,
	axis: 'x' | 'y',
): DropEdge {
	const rect = target.getBoundingClientRect();
	const past =
		axis === 'y'
			? event.clientY - rect.top > rect.height / 2
			: event.clientX - rect.left > rect.width / 2;
	return past ? 'after' : 'before';
}

/** Moves the item at `from` so it lands beside `target` on the given edge. */
export function reorderByDrop<T>(
	items: readonly T[],
	from: number,
	target: number,
	edge: DropEdge,
): T[] {
	if (from < 0 || from >= items.length || target < 0 || target >= items.length)
		return [...items];
	let insertAt = edge === 'before' ? target : target + 1;
	if (from < insertAt) insertAt -= 1;
	if (insertAt === from) return [...items];
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(insertAt, 0, moved as T);
	return next;
}

/**
 * Applies a saved ordering to a list: known keys come first in saved order,
 * anything new keeps its natural position after them.
 */
export function applyOrder<T>(
	items: readonly T[],
	order: readonly string[],
	key: (item: T) => string,
): T[] {
	const rank = new Map(order.map((value, index) => [value, index]));
	return [...items].sort((left, right) => {
		const l = rank.get(key(left)) ?? Number.POSITIVE_INFINITY;
		const r = rank.get(key(right)) ?? Number.POSITIVE_INFINITY;
		return l === r ? 0 : l - r;
	});
}
