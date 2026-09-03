import { Type, type TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { toolPolicySchema, type ToolPolicy } from './core';
import { ProtocolValidationError } from './errors';
import { heartbeatSchema, type Heartbeat } from './heartbeat';
import { agentEventSchema, type AgentEvent } from './events';
import {
	extensionsSchema,
	type Extensions,
	webExtensionBundlesSchema,
	type WebExtensionBundles,
} from './extensions';
import {
	fileRevertResultSchema,
	type FileRevertResult,
	gitCommitResultSchema,
	type GitCommitResult,
	gitStatusSchema,
	type GitStatus,
} from './git';
import {
	projectConfigSchema,
	type ProjectConfig,
	projectDomainsSchema,
	type ProjectDomains,
	storedProjectSchema,
	type StoredProject,
	workspaceDirectoryListingSchema,
	type WorkspaceDirectoryListing,
} from './projects';
import {
	composerCommandSchema,
	type ComposerCommand,
	providerStatusSchema,
	type ProviderStatus,
} from './providers';
import { registryStatusSchema, type RegistryStatus } from './registry';
import { agentRequestSchema, type AgentRequest } from './requests';
import { resourceCatalogSchema, type ResourceCatalog } from './resources';
import { agentResponseSchema, type AgentResponse } from './responses';
import {
	agentModelCatalogSchema,
	type AgentModelCatalog,
	sessionCatalogSchema,
	type SessionCatalog,
	sessionSnapshotSchema,
	type SessionSnapshot,
	sessionTreeSchema,
	type SessionTree,
} from './sessions';

type ParserKind = 'request' | 'response' | 'event';

/** Builds a parser that returns `input` typed as `T` or throws a ProtocolValidationError. */
function parser<T>(schema: TSchema, kind: ParserKind = 'response') {
	return (input: unknown): T => {
		if (!Value.Check(schema, input)) {
			throw new ProtocolValidationError(kind, input);
		}
		return input as T;
	};
}

export const parseRegistryStatus = parser<RegistryStatus>(registryStatusSchema);
export const parseAgentRequest = parser<AgentRequest>(
	agentRequestSchema,
	'request',
);
export const parseAgentResponse = parser<AgentResponse>(agentResponseSchema);
export const parseAgentEvent = parser<AgentEvent>(agentEventSchema, 'event');
export const parseStoredProjects = parser<StoredProject[]>(
	Type.Array(storedProjectSchema),
);
export const parseProviderStatuses = parser<ProviderStatus[]>(
	Type.Array(providerStatusSchema),
);
export const parseProjectDomains = parser<ProjectDomains>(projectDomainsSchema);
export const parseProjectConfig = parser<ProjectConfig>(projectConfigSchema);
export const parseWorkspaceDirectoryListing = parser<WorkspaceDirectoryListing>(
	workspaceDirectoryListingSchema,
);
export const parseSessionCatalog = parser<SessionCatalog>(sessionCatalogSchema);
export const parseSessionTree = parser<SessionTree>(sessionTreeSchema);
export const parseSessionSnapshot = parser<SessionSnapshot>(
	sessionSnapshotSchema,
);
export const parseHeartbeat = parser<Heartbeat>(heartbeatSchema);
/** Cheap shape check before the full parse; heartbeats are not events. */
export function isHeartbeat(input: unknown): input is Heartbeat {
	return (
		input !== null &&
		typeof input === 'object' &&
		'type' in input &&
		input.type === 'heartbeat'
	);
}
export const parseComposerCommands = parser<ComposerCommand[]>(
	Type.Array(composerCommandSchema),
);
export const parseAgentModelCatalog = parser<AgentModelCatalog>(
	agentModelCatalogSchema,
);
export const parseExtensions = parser<Extensions>(extensionsSchema);
export const parseWebExtensionBundles = parser<WebExtensionBundles>(
	webExtensionBundlesSchema,
);
export const parseFileRevertResult = parser<FileRevertResult>(
	fileRevertResultSchema,
);
export const parseGitStatus = parser<GitStatus>(gitStatusSchema);
export const parseGitCommitResult = parser<GitCommitResult>(
	gitCommitResultSchema,
);
export const parseResourceCatalog = parser<ResourceCatalog>(
	resourceCatalogSchema,
);
export const parseToolPolicy = parser<ToolPolicy>(toolPolicySchema);
