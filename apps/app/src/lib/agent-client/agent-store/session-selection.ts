import type {
	AgentModelOption,
	ConversationMessage,
	SessionState,
	SessionUsage,
} from '@gizmo/protocol';
import type { AgentModel } from '../AgentStore.svelte';

export interface SessionSelection {
	sessionId?: string;
	sessionState: SessionState;
	messages: ConversationMessage[];
	messagesLoading: boolean;
	model?: AgentModel;
	availableModels: AgentModelOption[];
	thinkingLevels: string[];
	enabledExtensionIds: string[];
	selectedProjectPath?: string;
	projectStatuses: Record<string, unknown>;
	projectServiceErrors: Record<string, string>;
	usage?: SessionUsage;
}
