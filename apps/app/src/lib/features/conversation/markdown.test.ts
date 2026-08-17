import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders agent Markdown with code copy controls', () => {
		const html = renderMarkdown(
			'## Result\n\n```csharp\nDebug.Log("ready");\n```',
		);

		expect(html).toContain('<h2>Result</h2>');
		expect(html).toContain('data-copy-code');
		expect(html).toContain('language-csharp');
	});

	it('does not allow model output to inject executable markup', () => {
		const html = renderMarkdown(
			'<script>alert(1)</script> [unsafe](javascript:alert(1))',
		);

		expect(html).not.toContain('<script');
		expect(html).not.toContain('href="javascript:');
	});
});
