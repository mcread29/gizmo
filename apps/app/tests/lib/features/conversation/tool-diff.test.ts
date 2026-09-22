import { describe, expect, it } from 'vitest';
import type { ToolCallView } from '@gizmo/protocol';
import { toolDiff } from '../../../../src/lib/features/conversation/tool-diff';
import {
	fakeEditFile,
	fakeEditResult,
} from '../../../../src/lib/agent-client/fake-client/fixtures';

const base: ToolCallView = {
	id: 't1',
	name: 'edit',
	status: 'complete',
	statusText: '',
	input: {},
	result: undefined,
};

describe('toolDiff', () => {
	it('counts a reported patch', () => {
		const patch = [
			'--- a/src/a.ts',
			'+++ b/src/a.ts',
			'@@ -1,2 +1,3 @@',
			' keep',
			'-old',
			'+new',
			'+more',
		].join('\n');
		const diff = toolDiff({ ...base, result: { patch } });
		expect(diff).toMatchObject({ file: 'src/a.ts', added: 2, removed: 1 });
	});

	it('builds a diff from an edit tool that only echoes its texts', () => {
		const diff = toolDiff({
			...base,
			input: { path: 'notes.md', oldText: 'a\nb\n', newText: 'a\nc\nd\n' },
			result: 'ok',
		});
		expect(diff).toMatchObject({ file: 'notes.md', added: 3, removed: 2 });
		expect(diff?.diff).toContain('+++ b/notes.md');
	});

	it('is absent when there is nothing to show', () => {
		expect(toolDiff({ ...base, input: { path: 'x' }, result: 'read' })).toBe(
			undefined,
		);
	});
});

it('counts the fake client edit patch', () => {
	const diff = toolDiff({
		...base,
		input: { file: fakeEditFile, oldText: 'a', newText: 'b' },
		result: fakeEditResult,
	});
	expect(diff?.file).toBe(fakeEditFile);
	expect(diff?.added).toBe(2);
	expect(diff?.removed).toBe(1);
});
