import type { ComposerCommand } from '@gizmo/protocol';

/** Commands the composer handles itself, offered alongside the agent's own. */
const localCommands: ComposerCommand[] = [
	{
		name: 'reload',
		description: 'Reload extension UI and activation state',
		source: 'extension',
	},
];

/**
 * Keeps a reference to a mounted element, releasing it on unmount — but only
 * if it is still the one held, so a remount that already replaced it wins.
 */
export function capture<T extends Element>(
	hold: (node: T | undefined) => void,
	held: () => T | undefined,
) {
	return (node: T) => {
		hold(node);
		return () => {
			if (held() === node) hold(undefined);
		};
	};
}

/** Grows a textarea with its content up to the CSS max-height, then scrolls. */
export function autoGrow(node: HTMLTextAreaElement) {
	const resize = () => resizeComposer(node);
	resize();
	node.addEventListener('input', resize);
	const observer =
		typeof ResizeObserver === 'undefined'
			? undefined
			: new ResizeObserver(resize);
	observer?.observe(node);
	return () => {
		node.removeEventListener('input', resize);
		observer?.disconnect();
	};
}

export function resizeComposer(node: HTMLTextAreaElement | undefined): void {
	if (!node) return;
	node.style.height = 'auto';
	const computedMax = Number.parseFloat(getComputedStyle(node).maxHeight);
	const maxHeight = Number.isFinite(computedMax) ? computedMax : 240;
	const height = Math.min(node.scrollHeight, maxHeight);
	node.style.height = `${height}px`;
	node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

/**
 * Enter sends, or Ctrl/Cmd+Enter does, depending on the user's preference.
 * Returns true when the event was consumed as a send.
 */
export function isSendKey(event: KeyboardEvent, sendOnEnter: boolean): boolean {
	if (event.key !== 'Enter') return false;
	return sendOnEnter ? !event.shiftKey : event.metaKey || event.ctrlKey;
}

/**
 * Commands offered for a `/query`, best matches first: names that start with
 * what was typed come before ones that merely contain it, so the obvious
 * command is never buried under a longer one that happens to sort earlier.
 */
export function matchCommands(
	query: string,
	agentCommands: readonly ComposerCommand[],
	limit = 10,
): ComposerCommand[] {
	const needle = query.toLocaleLowerCase();
	return [...localCommands, ...agentCommands]
		.filter(({ name, description }) =>
			`${name} ${description ?? ''}`.toLocaleLowerCase().includes(needle),
		)
		.sort((left, right) => {
			const leftStarts = left.name.toLocaleLowerCase().startsWith(needle);
			const rightStarts = right.name.toLocaleLowerCase().startsWith(needle);
			if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
			return left.name.localeCompare(right.name);
		})
		.slice(0, limit);
}
