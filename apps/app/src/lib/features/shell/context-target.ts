export type ContextKind =
	'shell' | 'thread' | 'message' | 'tool' | 'composer' | 'unity';

export interface ContextTarget {
	kind: ContextKind;
	id?: string;
	value?: string;
	label?: string;
	/** The field that was right-clicked, when it was an editable one. */
	editable?: HTMLInputElement | HTMLTextAreaElement;
	selectedText: string;
}

/**
 * Resolves what was right-clicked by walking up to the nearest element that
 * declares a `data-context-kind`. Components opt into the menu by tagging
 * themselves, so the menu never needs to know the component tree.
 */
export function readContextTarget(event: MouseEvent): ContextTarget {
	const eventTarget = event.target;
	const editable =
		eventTarget instanceof HTMLInputElement ||
		eventTarget instanceof HTMLTextAreaElement
			? eventTarget
			: undefined;
	const selectedText = editable
		? editable.value.slice(
				editable.selectionStart ?? 0,
				editable.selectionEnd ?? 0,
			)
		: (window.getSelection()?.toString() ?? '');

	const element =
		eventTarget instanceof Element
			? eventTarget.closest<HTMLElement>('[data-context-kind]')
			: undefined;

	return {
		kind: contextKind(element?.dataset.contextKind),
		...(element?.dataset.contextId ? { id: element.dataset.contextId } : {}),
		...(element?.dataset.contextValue
			? { value: element.dataset.contextValue }
			: {}),
		...(element?.dataset.contextLabel
			? { label: element.dataset.contextLabel }
			: {}),
		...(editable ? { editable } : {}),
		selectedText,
	};
}

export async function copyText(text: string | undefined): Promise<boolean> {
	if (!text || !navigator.clipboard) return false;
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Clipboard permissions can be denied outside a secure browser context.
		return false;
	}
}

export async function pasteInto(
	field: HTMLInputElement | HTMLTextAreaElement | undefined,
): Promise<void> {
	if (!field || !navigator.clipboard) return;
	try {
		const text = await navigator.clipboard.readText();
		const start = field.selectionStart ?? field.value.length;
		const end = field.selectionEnd ?? start;
		field.setRangeText(text, start, end, 'end');
		field.dispatchEvent(new InputEvent('input', { bubbles: true }));
	} catch {
		// Clipboard permissions can be denied outside a secure browser context.
	}
}

function contextKind(value: string | undefined): ContextKind {
	switch (value) {
		case 'thread':
		case 'message':
		case 'tool':
		case 'composer':
		case 'unity':
			return value;
		default:
			return 'shell';
	}
}
