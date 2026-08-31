/// <reference types="vite/client" />

interface ImportMeta {
	/** Set by Bun when this module is the process entry point. */
	readonly main?: boolean;
}

declare module '@gizmo/design';
