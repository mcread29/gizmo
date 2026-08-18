/**
 * A one-line description of what a tool call was actually asked to do.
 *
 * Eight cards reading "Unity commands / Completed" are indistinguishable; the
 * arguments are the only thing that tells them apart, so they belong in the
 * header rather than behind a disclosure.
 */

/** Argument names worth showing on their own, most identifying first. */
const primaryKeys = [
	'command',
	'file',
	'path',
	'filePath',
	'query',
	'filter',
	'category',
	'pattern',
	'name',
	'level',
	'mode',
];

const maxLength = 72;

export function toolSummary(input: unknown): string | undefined {
	if (typeof input === 'string') return truncate(input);
	if (!input || typeof input !== 'object' || Array.isArray(input)) return;

	const entries = Object.entries(input as Record<string, unknown>).filter(
		([, value]) => describable(value),
	);
	if (entries.length === 0) return;

	const primary = primaryKeys
		.map((key) => entries.find(([name]) => name === key))
		.find((entry) => entry !== undefined);

	// A single identifying argument reads better bare than as key=value.
	if (primary && entries.length === 1) return truncate(describe(primary[1]));

	const ordered = primary
		? [primary, ...entries.filter((entry) => entry !== primary)]
		: entries;
	return truncate(
		ordered.map(([key, value]) => `${key}=${describe(value)}`).join(' · '),
	);
}

/** The full argument list, for the expanded card. */
export function toolParameters(input: unknown): [string, string][] {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
	return Object.entries(input as Record<string, unknown>).map(
		([key, value]) => [key, describe(value, true)],
	);
}

function describable(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function describe(value: unknown, full = false): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return full
			? JSON.stringify(value)
			: `${value.length} item${value.length === 1 ? '' : 's'}`;
	}
	return JSON.stringify(value) ?? '';
}

function truncate(value: string): string {
	const text = value.replace(/\s+/g, ' ').trim();
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
