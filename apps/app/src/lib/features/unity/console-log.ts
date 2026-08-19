import type { UnityConsoleEntry } from '@unity-agent/protocol';

export function matchesConsoleFilter(
	entry: UnityConsoleEntry,
	level: string,
	text: string,
): boolean {
	if (level !== 'all' && entry.level !== level) return false;
	const needle = text.trim().toLowerCase();
	if (!needle) return true;
	return `${entry.message} ${entry.file ?? ''}`.toLowerCase().includes(needle);
}

/** One line of plain text, for copying out to an issue or a message. */
export function consoleLine(entry: UnityConsoleEntry): string {
	const location = entry.file
		? ` (${entry.file}${entry.line ? `:${entry.line}` : ''})`
		: '';
	const stamp = entry.timestamp ? `${entry.timestamp} ` : '';
	return `${stamp}[${entry.level}] ${entry.message}${location}`;
}

export function consoleErrorCount(entries: UnityConsoleEntry[]): number {
	return entries.filter((entry) => entry.level === 'error').length;
}

export function consoleTimeLabel(timestamp: string): string {
	return timestamp.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? timestamp;
}

export function consoleSourceLabel(file: string, line?: number): string {
	const parts = file.split(/[\\/]/).filter(Boolean);
	const path = parts.slice(-2).join('/') || file;
	return line ? `${path}:${line}` : path;
}
