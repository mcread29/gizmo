export type DiffLineKind =
	'file' | 'range' | 'added' | 'removed' | 'context' | 'meta';

export interface DiffLine {
	kind: DiffLineKind;
	text: string;
	oldLine?: number;
	newLine?: number;
}

const rangeHeader = /^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parses a unified diff into rows with line numbers. Prefix characters are only
 * meaningful inside a hunk, so `---`/`+++` file headers and any content line
 * that happens to begin with a dash are classified by position, not by guess.
 */
export function parseDiff(diff: string): DiffLine[] {
	const lines: DiffLine[] = [];
	let oldLine = 0;
	let newLine = 0;
	let inHunk = false;

	for (const text of diff.split('\n')) {
		const range = rangeHeader.exec(text);
		if (range) {
			oldLine = Number(range[1]);
			newLine = Number(range[2]);
			inHunk = true;
			lines.push({ kind: 'range', text });
			continue;
		}
		if (!inHunk) {
			lines.push({
				kind:
					text.startsWith('---') ||
					text.startsWith('+++') ||
					text.startsWith('diff ')
						? 'file'
						: 'meta',
				text,
			});
			continue;
		}
		if (text.startsWith('\\')) {
			lines.push({ kind: 'meta', text });
			continue;
		}
		if (text.startsWith('+')) {
			lines.push({ kind: 'added', text: text.slice(1), newLine: newLine++ });
			continue;
		}
		if (text.startsWith('-')) {
			lines.push({ kind: 'removed', text: text.slice(1), oldLine: oldLine++ });
			continue;
		}
		lines.push({
			kind: 'context',
			text: text.startsWith(' ') ? text.slice(1) : text,
			oldLine: oldLine++,
			newLine: newLine++,
		});
	}
	// A trailing newline in the payload is not a row.
	if (lines.at(-1)?.text === '' && lines.at(-1)?.kind === 'context') {
		lines.pop();
	}
	return lines;
}

export interface DiffStat {
	added: number;
	removed: number;
}

export function diffStat(lines: DiffLine[]): DiffStat {
	return {
		added: lines.filter((line) => line.kind === 'added').length,
		removed: lines.filter((line) => line.kind === 'removed').length,
	};
}
