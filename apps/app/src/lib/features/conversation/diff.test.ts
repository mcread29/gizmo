import { describe, expect, it } from 'vitest';
import { diffStat, parseDiff } from './diff';

const patch = [
	'--- a/Assets/Player.cs',
	'+++ b/Assets/Player.cs',
	'@@ -4,3 +4,4 @@',
	' void Start()',
	'-    speed = 1;',
	'+    speed = 2;',
	'+    // -1 means unset',
	' }',
].join('\n');

describe('parseDiff', () => {
	it('numbers both sides and keeps hunk lines aligned', () => {
		const lines = parseDiff(patch);

		expect(lines.slice(0, 3).map((line) => line.kind)).toEqual([
			'file',
			'file',
			'range',
		]);
		expect(lines[3]).toMatchObject({ kind: 'context', oldLine: 4, newLine: 4 });
		expect(lines[4]).toMatchObject({ kind: 'removed', oldLine: 5 });
		expect(lines[5]).toMatchObject({ kind: 'added', newLine: 5 });
		expect(lines.at(-1)).toMatchObject({
			kind: 'context',
			oldLine: 6,
			newLine: 7,
		});
	});

	it('does not mistake file headers or content dashes for changes', () => {
		const lines = parseDiff(patch);

		// "// -1 means unset" is an addition whose body starts with a dash.
		expect(lines[6]).toMatchObject({
			kind: 'added',
			text: '    // -1 means unset',
		});
		expect(diffStat(lines)).toEqual({ added: 2, removed: 1 });
	});
});
