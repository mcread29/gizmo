import { diffStat, parseDiff } from '@gizmo/ui';
import { recordValue, stringValue } from '@gizmo/design/format';
import type { ToolCallView } from '@gizmo/protocol';

export interface ToolDiff {
	diff: string;
	file?: string;
	added: number;
	removed: number;
}

/**
 * The change a tool made, as a unified diff, however the tool reported it.
 * A `patch` or `diff` in the result is taken as is; an edit tool that only
 * echoes its `oldText`/`newText` gets one built from them, so its card can
 * still say "+12 −3" and colour the change when opened.
 */
export function toolDiff(tool: ToolCallView): ToolDiff | undefined {
	const reported =
		stringValue(recordValue(tool.result, 'patch')) ??
		stringValue(recordValue(tool.result, 'diff'));
	const file =
		stringValue(recordValue(tool.result, 'file')) ??
		stringValue(recordValue(tool.input, 'path')) ??
		stringValue(recordValue(tool.input, 'file')) ??
		stringValue(recordValue(tool.input, 'filePath')) ??
		(reported ? patchFileName(reported) : undefined);
	const diff = reported ?? synthesize(tool.input, file);
	if (!diff) return undefined;
	const stat = diffStat(parseDiff(diff));
	return {
		diff,
		...(file ? { file } : {}),
		added: stat.added,
		removed: stat.removed,
	};
}

function synthesize(input: unknown, file: string | undefined) {
	const oldText = stringValue(recordValue(input, 'oldText'));
	const newText = stringValue(recordValue(input, 'newText'));
	if (oldText === undefined || newText === undefined) return undefined;
	const removed = lines(oldText);
	const added = lines(newText);
	const name = file ?? 'file';
	return [
		`--- a/${name}`,
		`+++ b/${name}`,
		`@@ -1,${removed.length} +1,${added.length} @@`,
		...removed.map((line) => `-${line}`),
		...added.map((line) => `+${line}`),
	].join('\n');
}

function lines(text: string): string[] {
	return text === '' ? [] : text.replace(/\n$/, '').split('\n');
}

export function patchFileName(patch: string): string | undefined {
	for (const line of patch.split('\n')) {
		if (!line.startsWith('+++ ')) continue;
		const value = line.slice(4).trim().split('\t')[0];
		if (!value || value === '/dev/null') continue;
		return value.replace(/^[ab]\//, '');
	}
	return undefined;
}
