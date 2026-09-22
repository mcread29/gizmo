import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { ProjectService } from './project-service';
import type {
	Command,
	ExtensionHost,
	SettingsField,
	StatusItem,
	ToolPresentation,
	UiContext,
	ViewDefinition,
} from './ui';

export interface ExtensionContext {
	workspacePath: string;
	/**
	 * The extension's stored settings, as the server holds them. Tools read
	 * the values captured when the session started; a change takes effect on
	 * the next session or after a runtime reload.
	 */
	settings: Readonly<Record<string, unknown>>;
	/**
	 * Asks the user a yes/no question in every connected client. `kind` is
	 * the extension's own identifier for the question; `title` and `message`
	 * are what the user reads.
	 */
	confirm(
		kind: string,
		options?: { title?: string; message?: string },
	): Promise<boolean>;
}

/**
 * Describes one live operation the extension exposes to the UI through
 * `invoke`. Kept for extensions with RPC-style operations the host itself
 * calls (Git's status and commit are the first-party example).
 */
export interface ExtensionOperation {
	id: string;
	mutates: boolean;
	requiresConfirmation: boolean;
}

export interface ExtensionDescriptor {
	id: string;
	name: string;
	version: string;
	apiVersion: number;
	capabilities: string[];
	operations: ExtensionOperation[];
}

/**
 * A Gizmo extension: a Pi extension that also exports one of these as
 * `gizmoExtension`. Every capability is optional. The server-side parts run
 * wherever the extension is enabled; the UI parts are data the host renders,
 * so an extension never ships browser code.
 */
export interface GizmoExtension {
	id: string;
	name: string;
	/**
	 * Absolute path to the extension's own package root. Skills and prompt
	 * templates the package ships are discovered from here using Pi's package
	 * convention. Filled in by the loader; extensions need not set it.
	 */
	packageRoot?: string;
	/**
	 * Set by the loader on an extension found under a workspace's
	 * `.pi/extensions`; it is only offered to that workspace.
	 */
	workspaceRoot?: string;
	systemPrompt?: string;
	createTools?(context: ExtensionContext): ToolDefinition[];
	list?(
		workspacePath: string,
		signal: AbortSignal,
	): Promise<ExtensionDescriptor[]>;
	invoke?(
		workspacePath: string,
		extensionId: string,
		operationId: string,
		input: unknown,
		signal: AbortSignal,
	): Promise<unknown>;
	createProjectService?(): ProjectService;

	/** Called once when the extension is registered, before any UI request. */
	activate?(host: ExtensionHost): void | Promise<void>;
	/** Inspector tabs and modals, opened on demand. */
	views?: Record<string, ViewDefinition>;
	/** Titlebar indicators, re-fetched after `host.uiChanged()`. */
	statusItems?(context: UiContext): StatusItem[] | Promise<StatusItem[]>;
	/** Command palette entries, re-fetched after `host.uiChanged()`. */
	commands?(context: UiContext): Command[] | Promise<Command[]>;
	/** Runs a command that names no view. */
	runCommand?(commandId: string, context: UiContext): void | Promise<void>;
	/** A settings form the host renders under Settings → Extensions. */
	settings?: SettingsField[];
	toolPresentation?: ToolPresentation;

	/**
	 * Called when the extension is replaced by a reload or unlinked. Release
	 * timers, sockets, watchers, and child processes here: the module graph is
	 * re-evaluated on reload, so anything left running would leak.
	 */
	dispose?(): void | Promise<void>;
}

/** @deprecated Use `GizmoExtension`. */
export type GizmoServerExtension = GizmoExtension;

export interface ActiveExtensions {
	extensions: GizmoExtension[];
	systemPrompt?: string;
	tools: ToolDefinition[];
}

/** Identity with inference: `export const gizmoExtension = defineExtension({...})`. */
export function defineExtension<T extends GizmoExtension>(extension: T): T {
	return extension;
}
