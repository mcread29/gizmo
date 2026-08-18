import type { SessionTree, SessionTreeEntry } from '@unity-agent/protocol';

/**
 * Which entries the tree shows. Filtering never changes the shape of the
 * session: hidden entries keep their descendants, which re-attach to the
 * nearest ancestor that is still visible.
 */
export const treeFilters = [
	'default',
	'no-tools',
	'user-only',
	'labeled-only',
	'all',
] as const;

export type TreeFilter = (typeof treeFilters)[number];

export const treeFilterLabels: Record<TreeFilter, string> = {
	default: 'Messages',
	'no-tools': 'No tool calls',
	'user-only': 'Prompts only',
	'labeled-only': 'Labelled only',
	all: 'Everything',
};

export interface TreeRow {
	entry: SessionTreeEntry;
	depth: number;
	/** On the path from root to the current leaf. */
	active: boolean;
	/** Where the next message would be appended. */
	leaf: boolean;
	/** Has children the filter is showing. */
	foldable: boolean;
	folded: boolean;
	/** Siblings under the same visible parent, so branches can be counted. */
	branchIndex: number;
	branchCount: number;
}

export interface TreeViewOptions {
	filter?: TreeFilter;
	search?: string;
	folded?: ReadonlySet<string>;
}

function matchesFilter(entry: SessionTreeEntry, filter: TreeFilter): boolean {
	if (filter === 'all') return true;
	if (entry.label) return true;
	if (filter === 'labeled-only') return false;
	if (filter === 'user-only') return entry.kind === 'user';
	if (entry.kind === 'tool') return false;
	if (filter === 'no-tools') return true;
	return entry.kind === 'user' || entry.kind === 'assistant';
}

function matchesSearch(entry: SessionTreeEntry, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return `${entry.summary} ${entry.detail ?? ''} ${entry.label ?? ''}`
		.toLowerCase()
		.includes(needle);
}

/** Ids from the leaf up to the root: the path the transcript walks. */
export function activePath(tree: SessionTree): Set<string> {
	const byId = new Map(tree.entries.map((entry) => [entry.id, entry]));
	const path = new Set<string>();
	let current = tree.leafId;
	while (current) {
		if (path.has(current)) break;
		path.add(current);
		current = byId.get(current)?.parentId ?? null;
	}
	return path;
}

/**
 * The flat list of rows to render, in document order, at the depth each row
 * sits once hidden ancestors are collapsed away. Depth only increases where
 * the thread actually splits: a single-child chain is one conversation, not a
 * staircase.
 */
export function treeRows(
	tree: SessionTree,
	options: TreeViewOptions = {},
): TreeRow[] {
	const {
		filter = 'default',
		search = '',
		folded = new Set<string>(),
	} = options;
	const byId = new Map(tree.entries.map((entry) => [entry.id, entry]));
	const path = activePath(tree);

	const visible = new Set<string>();
	for (const entry of tree.entries) {
		if (matchesFilter(entry, filter)) visible.add(entry.id);
	}

	// A search keeps the ancestors of every hit, so a match never appears
	// detached from the branch it belongs to.
	if (search.trim()) {
		const kept = new Set<string>();
		for (const entry of tree.entries) {
			if (!visible.has(entry.id) || !matchesSearch(entry, search)) continue;
			let current: string | null = entry.id;
			while (current && !kept.has(current)) {
				if (visible.has(current)) kept.add(current);
				current = byId.get(current)?.parentId ?? null;
			}
		}
		for (const id of [...visible]) if (!kept.has(id)) visible.delete(id);
	}

	const visibleParent = (entry: SessionTreeEntry): string | null => {
		let current = entry.parentId;
		while (current && !visible.has(current)) {
			current = byId.get(current)?.parentId ?? null;
		}
		return current;
	};

	const children = new Map<string | null, SessionTreeEntry[]>();
	for (const entry of tree.entries) {
		if (!visible.has(entry.id)) continue;
		const parent = visibleParent(entry);
		const siblings = children.get(parent) ?? [];
		siblings.push(entry);
		children.set(parent, siblings);
	}

	const rows: TreeRow[] = [];
	const walk = (parent: string | null, depth: number): void => {
		const siblings = children.get(parent) ?? [];
		siblings.forEach((entry, index) => {
			const kids = children.get(entry.id) ?? [];
			const isFolded = folded.has(entry.id);
			rows.push({
				entry,
				depth,
				active: path.has(entry.id),
				leaf: tree.leafId === entry.id,
				foldable: kids.length > 0,
				folded: isFolded,
				branchIndex: index,
				branchCount: siblings.length,
			});
			// Depth follows where the thread splits, not how deep the chain is.
			if (!isFolded) walk(entry.id, kids.length > 1 ? depth + 1 : depth);
		});
	};
	walk(null, 0);
	return rows;
}
