/**
 * Thin wrapper over the Tauri APIs. Everything is dynamically imported and
 * guarded, so the same build runs in a plain browser during development with
 * the desktop-only affordances simply absent.
 */
export function isDesktop(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Returns the chosen path, or undefined when unavailable or dismissed. */
export async function saveTextFile(
	suggestedName: string,
	contents: string,
): Promise<string | undefined> {
	if (!isDesktop()) return undefined;
	const { invoke } = await import('@tauri-apps/api/core');
	const path = await invoke<string | null>('save_text_file', {
		suggestedName,
		contents,
	});
	return path ?? undefined;
}

export async function minimizeWindow(): Promise<void> {
	await withWindow((window) => window.minimize());
}

export async function toggleMaximizeWindow(): Promise<void> {
	await withWindow((window) => window.toggleMaximize());
}

export async function closeWindow(): Promise<void> {
	await withWindow((window) => window.close());
}

async function withWindow(
	action: (window: {
		minimize(): Promise<void>;
		toggleMaximize(): Promise<void>;
		close(): Promise<void>;
	}) => Promise<void>,
): Promise<void> {
	if (!isDesktop()) return;
	const { getCurrentWindow } = await import('@tauri-apps/api/window');
	await action(getCurrentWindow());
}
