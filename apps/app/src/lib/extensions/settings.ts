/**
 * Extension settings are client-local: the values live in this browser's
 * layout, and a view is opened with a snapshot of them. Nothing is stored on
 * the server, so an extension never has to persist per-user preferences.
 */
export interface ExtensionSettingsContext {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}
