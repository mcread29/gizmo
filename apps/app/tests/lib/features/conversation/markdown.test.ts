import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../../../src/lib/features/conversation/markdown';

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

	it('highlights C# and leaves unknown languages as plain escaped text', () => {
		const highlighted = renderMarkdown('```csharp\nvar speed = 1;\n```');
		expect(highlighted).toContain('hljs-keyword');
		expect(highlighted).toContain('language-csharp');

		const plain = renderMarkdown('```shaderlab\nProperties { }\n```');
		expect(plain).toContain('language-shaderlab');
		expect(plain).not.toContain('hljs-');
	});

	it('maps common aliases onto the languages it can highlight', () => {
		expect(renderMarkdown('```cs\nint x;\n```')).toContain('language-csharp');
		expect(renderMarkdown('```sh\nls -al\n```')).toContain('language-bash');
	});

	it('renders link labels through the parser marked binds', () => {
		const html = renderMarkdown('see [the **docs**](https://example.com)');
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('<strong>docs</strong>');
		expect(html).not.toContain('[object');
	});
});
