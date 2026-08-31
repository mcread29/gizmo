interface RuntimeEvent {
	sessionId: string;
	runtimeId: string;
}

export function upsertByKey<
	T extends RuntimeEvent & {
		request: { key: string };
	},
>(items: T[], incoming: T) {
	return [
		...items.filter(
			(item) =>
				item.sessionId !== incoming.sessionId ||
				item.runtimeId !== incoming.runtimeId ||
				item.request.key !== incoming.request.key,
		),
		incoming,
	];
}

export function emptyReadonlySet<T>() {
	return new Set<T>();
}

export function addToReadonlySet<T>(items: ReadonlySet<T>, incoming: T) {
	return new Set([...items, incoming]);
}

export function removeFromReadonlySet<T>(items: ReadonlySet<T>, removed: T) {
	return new Set([...items].filter((item) => item !== removed));
}

export function findLatest<T>(items: T[], matches: (item: T) => boolean) {
	for (let index = items.length - 1; index >= 0; index--) {
		const item = items[index];
		if (item !== undefined && matches(item)) return item;
	}
	return undefined;
}
