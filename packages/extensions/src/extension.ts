import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { ExtensionDescriptor, WorkspaceProfile } from '@gizmo/protocol';
import type { ProjectService } from './project-service';

export interface ExtensionContext {
	workspacePath: string;
	confirm(kind: string): Promise<boolean>;
}

/**
 * A self-contained integration, discovered and loaded by id. Every capability
 * is optional — an extension contributes whichever of these it actually has:
 * workspace detection and tools/system prompt, live RPC-style operations for
 * the UI, or a project process (status/watch/open/revert).
 */
export interface GizmoServerExtension {
	id: string;
	name: string;
	detect?(workspacePath: string): Promise<boolean>;
	detectRoots?(workspacePath: string): Promise<string[]>;
	profile?(root: string): WorkspaceProfile;
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
}

export interface ActiveExtensions {
	extensions: GizmoServerExtension[];
	systemPrompt?: string;
	tools: ToolDefinition[];
}
