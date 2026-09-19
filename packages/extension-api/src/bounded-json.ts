/**
 * Bounds the work done before schema validation: rejects non-JSON data,
 * cycles, accessors, and payloads over budget without walking them fully.
 */
export function boundedJson(
	value: unknown,
	budget = 64_000,
	entries = 10_000,
): boolean {
	const visit = (item: unknown, depth: number): boolean => {
		if (--entries < 0 || depth > 24) return false;
		if (typeof item === 'string') return (budget -= item.length) >= 0;
		if (item === null || typeof item === 'boolean') return true;
		if (typeof item === 'number') return Number.isFinite(item);
		if (typeof item !== 'object') return false;
		if (
			!Array.isArray(item) &&
			Object.getPrototypeOf(item) !== Object.prototype &&
			Object.getPrototypeOf(item) !== null
		)
			return false;
		for (const key of Object.keys(item)) {
			if ((budget -= key.length) < 0) return false;
			const descriptor = Object.getOwnPropertyDescriptor(item, key);
			if (
				!descriptor ||
				!('value' in descriptor) ||
				!visit(descriptor.value, depth + 1)
			)
				return false;
		}
		return true;
	};
	return visit(value, 0);
}
