import type { ToolCallView } from '@unity-agent/protocol';

export interface WorkspaceView {
	domainId?: string;
	workspacePath?: string;
	workspaceName: string;
	subtitle: string;
	state?: string;
	toolActivity: ToolCallView[];
	canOpen: boolean;
	open(): void;
	refresh(): void;
}
