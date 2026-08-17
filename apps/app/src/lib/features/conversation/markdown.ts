import DOMPurify from 'dompurify';
import { Marked, Renderer } from 'marked';

const renderer = new Renderer();

renderer.html = ({ text }) => escapeHtml(text);
renderer.code = ({ text, lang }) => {
	const language = lang?.trim().split(/\s+/)[0] ?? 'text';
	return `<div data-ui="code-block"><div data-ui="code-toolbar"><span>${escapeHtml(language)}</span><button type="button" data-copy-code>Copy</button></div><pre><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre></div>`;
};
renderer.link = ({ href, title, tokens }) => {
	const label = renderer.parser.parseInline(tokens);
	const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
	return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noreferrer">${label}</a>`;
};

const markdown = new Marked({
	breaks: true,
	gfm: true,
	renderer,
});

export function renderMarkdown(source: string): string {
	const rendered = markdown.parse(source, { async: false });
	return DOMPurify.sanitize(rendered, {
		ADD_ATTR: ['target'],
	});
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[character]!,
	);
}
