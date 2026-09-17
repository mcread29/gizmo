/**
 * Copies text, falling back to the legacy selection command where the async
 * clipboard is missing. `navigator.clipboard` exists only in secure contexts,
 * and Gizmo is routinely opened over plain http on a LAN or tailnet address,
 * where every copy button used to do nothing at all.
 */
export async function copyToClipboard(
	text: string | undefined,
): Promise<boolean> {
	if (!text) return false;
	if (navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Permission denied or unavailable; try the legacy path below.
		}
	}
	return copyBySelection(text);
}

function copyBySelection(text: string): boolean {
	if (typeof document === 'undefined' || !document.execCommand) return false;
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.top = '0';
	area.style.left = '0';
	area.style.opacity = '0';
	area.style.pointerEvents = 'none';
	const active = document.activeElement;
	document.body.append(area);
	area.select();
	let copied = false;
	try {
		copied = document.execCommand('copy');
	} catch {
		copied = false;
	}
	area.remove();
	if (active instanceof HTMLElement) active.focus();
	return copied;
}
