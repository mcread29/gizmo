import type { SessionSnapshot } from '@gizmo/protocol';
import { formatToolResult } from '@gizmo/design/format';

/** Renders a session as the Markdown document the export action writes out. */
export function transcriptMarkdown(
	snapshot: SessionSnapshot,
	agentName: string,
): string {
	const lines = [`# ${snapshot.session.title}`, ''];
	for (const message of snapshot.messages) {
		lines.push(`## ${message.role === 'user' ? 'You' : agentName}`, '');
		if (message.content) lines.push(message.content, '');
		for (const tool of message.tools) {
			lines.push(`- \`${tool.name}\`: ${tool.statusText}`);
			if (tool.result !== undefined) {
				lines.push('', '```json', formatToolResult(tool.result), '```', '');
			}
		}
	}
	return lines.join('\n');
}

export function transcriptFileName(title: string): string {
	return `${title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'session'}.md`;
}

export function downloadTranscript(markdown: string, fileName: string): void {
	const url = URL.createObjectURL(
		new Blob([markdown], { type: 'text/markdown' }),
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	// Revoking in the same task can cancel the download in some webviews.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
