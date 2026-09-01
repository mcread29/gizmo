export interface ShortcutActions {
	newThread: () => void;
	openSettings: () => void;
	openTree: () => void;
	focusComposer: () => void;
	toggleLeft: () => void;
	toggleRight: () => void;
	openPalette: () => void;
	searchThreads: () => void;
	findInThread: () => void;
	dismiss: () => void;
}

/**
 * Desktop keyboard map. Modifier is Command on macOS and Control elsewhere;
 * shortcuts that would shadow text editing are skipped while a field has focus.
 */
export function handleShortcut(
	event: KeyboardEvent,
	actions: ShortcutActions,
): void {
	if (event.key === 'Escape') {
		actions.dismiss();
		return;
	}

	const modifier = event.metaKey || event.ctrlKey;
	if (!modifier || event.altKey) return;

	const action = shortcutFor(event.key.toLowerCase(), event.shiftKey);
	if (!action) return;
	event.preventDefault();
	actions[action]();
}

export function shortcutHint(key: string): string {
	const mac =
		typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '');
	return `${mac ? '⌘' : 'Ctrl'}${key}`;
}

function shortcutFor(
	key: string,
	shift: boolean,
): keyof ShortcutActions | undefined {
	if (key === 'n' && !shift) return 'newThread';
	if (key === ',' && !shift) return 'openSettings';
	if (key === 't' && shift) return 'openTree';
	if (key === 'k' && !shift) return 'openPalette';
	if (key === 'k' && shift) return 'searchThreads';
	if (key === 'f' && !shift) return 'findInThread';
	if (key === 'l' && shift) return 'focusComposer';
	if (key === 'b' && !shift) return 'toggleLeft';
	if (key === 'b' && shift) return 'toggleRight';
	return undefined;
}
