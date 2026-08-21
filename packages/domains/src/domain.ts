import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { WorkspaceProfile } from '@unity-agent/protocol';

export interface DomainContext {
	workspacePath: string;
	confirm(kind: string): Promise<boolean>;
}

/** A self-contained integration for one kind of workspace. */
export interface WorkspaceDomain {
	id: string;
	name: string;
	detect(workspacePath: string): Promise<boolean>;
	detectRoots?(workspacePath: string): Promise<string[]>;
	profile(root: string): WorkspaceProfile;
	systemPrompt: string;
	createTools(context: DomainContext): ToolDefinition[];
}

export interface ActiveDomains {
	domains: WorkspaceDomain[];
	systemPrompt?: string;
	tools: ToolDefinition[];
}
