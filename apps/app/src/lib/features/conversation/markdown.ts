import DOMPurify from 'dompurify';
import { Marked, Renderer } from 'marked';
import { highlightCode, resolveLanguage } from './highlight';

const renderer = new Renderer();

renderer.html = ({ text }) => escapeHtml(text);
renderer.code = ({ text, lang }) => {
	const language = lang?.trim().split(/\s+/)[0] || 'text';
	const highlighted = highlightCode(text, language) ?? escapeHtml(text);
	const label = resolveLanguage(language) ?? language;
	return `<div data-ui="code-block"><div data-ui="code-toolbar"><span>${escapeHtml(label)}</span><button type="button" data-copy-code>Copy</button></div><pre><code class="hljs language-${escapeHtml(label)}">${highlighted}</code></pre></div>`;
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

const completedCache = new Map<string, string>();
const completedCacheLimit = 100;

export function renderMarkdown(source: string, cache = true): string {
	const cached = cache ? completedCache.get(source) : undefined;
	if (cached !== undefined) return cached;
	const rendered = markdown.parse(source, { async: false });
	const sanitized = DOMPurify.sanitize(rendered, {
		ADD_ATTR: ['target'],
	});
	if (cache) {
		if (completedCache.size >= completedCacheLimit) {
			completedCache.delete(completedCache.keys().next().value!);
		}
		completedCache.set(source, sanitized);
	}
	return sanitized;
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
