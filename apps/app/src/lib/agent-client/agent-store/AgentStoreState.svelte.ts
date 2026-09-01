import type {
	AgentModelOption,
	AgentSessionSummary,
	CompactionPolicy,
	ComposerCommand,
	ConversationMessage,
	ExtensionDescriptor,
	GitStatus,
	ProviderStatus,
	RegistryStatus,
	ResourceCatalog,
	SessionState,
	SessionUsage,
	StoredProject,
	ToolPolicy,
} from '@gizmo/protocol';
import type {
	AgentError,
	AgentModel,
	ConnectionState,
	PendingConfirmation,
} from './types';

/** Reactive data owned by the coordinating AgentStore facade. */
export class AgentStoreState {
	compactionPolicy: CompactionPolicy = {
		enabled: true,
		fillPercent: 25,
		retainPercent: 10,
	};
	compacting = $state(false);
	lastAutomaticCompactionReason = $state<'threshold' | 'overflow'>();
	connection = $state<ConnectionState>('disconnected');
	reconnectAttempt = $state(0);
	sessionId = $state<string>();
	sessionState = $state<SessionState>('idle');
	sessionStates = $state<Record<string, SessionState>>({});
	model = $state<AgentModel>();
	availableModels = $state<AgentModelOption[]>([]);
	thinkingLevels = $state<string[]>([]);
	modelLoading = $state(false);
	activeTools = $state<string[]>([]);
	commands = $state.raw<ComposerCommand[]>([]);
	enabledExtensionIds = $state<string[]>([]);
	messages = $state<ConversationMessage[]>([]);
	messagesLoading = $state(false);
	lastPrompt = $state<string>();
	sessions = $state<AgentSessionSummary[]>([]);
	projects = $state<StoredProject[]>([]);
	selectedProjectPath = $state<string>();
	/** Opaque project-service status payloads, keyed by extension id. */
	projectStatuses = $state<Record<string, unknown>>({});
	projectsLoading = $state(false);
	projectOpening = $state<Record<string, boolean>>({});
	projectError = $state<string>();
	/** Per-extension project-service error messages, keyed by extension id. */
	projectServiceErrors = $state<Record<string, string>>({});
	error = $state<AgentError>();
	projectExtensions = $state<ExtensionDescriptor[]>([]);
	extensionsLoading = $state(false);
	usage = $state<SessionUsage>();
	pendingConfirmations = $state<PendingConfirmation[]>([]);
	gitStatus = $state<GitStatus>();
	gitLoading = $state(false);
	statusLoading = $state<Record<string, boolean>>({});
	gitCommitting = $state(false);
	resources = $state<ResourceCatalog>();
	resourcesLoading = $state(false);
	runtimeReloading = $state(false);
	resourceError = $state<string>();
	providers = $state.raw<ProviderStatus[]>([]);
	providersLoading = $state(false);
	providerError = $state<string>();
	registryStatus = $state<RegistryStatus>();
	registryBusy = $state(false);
	registryError = $state<string>();
	toolPolicy = $state<ToolPolicy>();
	toolPolicyLoading = $state(false);
	toolPolicyError = $state<string>();
}
