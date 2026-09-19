import type { Intent } from '@gizmo/extension-api';
import { sourceHref } from '@gizmo/ui';

/**
 * The three things a view can ask the host to do without a round trip to the
 * extension. Injected rather than imported so a test (and a tool result card,
 * which has no thread to switch) can supply its own.
 */
export interface ViewIntentHost {
	openFile(path: string, line?: number, column?: number): void;
	openDiff(path: string): void;
	openThread(sessionId: string): void;
	openUrl(url: string): void;
}

/** Resolves an intent's target against the block the user picked in. */
export function intentPath(
	intent: Intent,
	pathOf: (blockId: string) => string | undefined,
): string | undefined {
	if (intent.kind === 'openThread' || intent.kind === 'openUrl')
		return undefined;
	return intent.target.kind === 'path'
		? intent.target.path
		: pathOf(intent.target.blockId);
}

export function runIntent(
	intent: Intent,
	host: ViewIntentHost,
	pathOf: (blockId: string) => string | undefined,
): void {
	if (intent.kind === 'openThread') {
		host.openThread(intent.sessionId);
		return;
	}
	if (intent.kind === 'openUrl') {
		host.openUrl(intent.url);
		return;
	}
	const path = intentPath(intent, pathOf);
	if (!path) return;
	if (intent.kind === 'openFile') host.openFile(path, intent.line, intent.column);
	else host.openDiff(path);
}

/**
 * The app's own handler. Files open in the user's editor, the same deep link
 * the transcript's source references use. Gizmo has no diff surface of its
 * own yet and no request that would fetch a file's patch, so `openDiff` opens
 * the file too rather than doing nothing.
 */
export function appIntentHost(
	projectPath: string | undefined,
	openThread: (sessionId: string) => void,
): ViewIntentHost {
	const open = (path: string, line?: number, column?: number) => {
		const href = sourceHref(path, projectPath, line, column);
		if (href) window.open(href, '_self');
	};
	return {
		openFile: open,
		openDiff: (path) => open(path),
		openThread,
		// `noopener` so the extension's page cannot reach back through
		// `window.opener` into the app.
		openUrl: (url) => void window.open(url, '_blank', 'noopener'),
	};
}
