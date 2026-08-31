import { Type } from 'typebox';
import { Value } from 'typebox/value';
import { toolPolicySchema, type ToolPolicy } from './core';
import { ProtocolValidationError } from './errors';
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
	projectStatusSchema,
	type ProjectStatus,
	storedProjectSchema,
	type StoredProject,
	unityOpenProjectResultSchema,
	type UnityOpenProjectResult,
	unityProjectSchema,
	type UnityProject,
	unityStatusSchema,
	type UnityStatus,
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

export function parseRegistryStatus(input: unknown): RegistryStatus {
	if (!Value.Check(registryStatusSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseAgentRequest(input: unknown): AgentRequest {
	if (!Value.Check(agentRequestSchema, input)) {
		throw new ProtocolValidationError('request', input);
	}
	return input;
}

export function parseAgentResponse(input: unknown): AgentResponse {
	if (!Value.Check(agentResponseSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseAgentEvent(input: unknown): AgentEvent {
	if (!Value.Check(agentEventSchema, input)) {
		throw new ProtocolValidationError('event', input);
	}
	return input;
}

export function parseUnityProjects(input: unknown): UnityProject[] {
	const schema = Type.Array(unityProjectSchema);
	if (!Value.Check(schema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseStoredProjects(input: unknown): StoredProject[] {
	const schema = Type.Array(storedProjectSchema);
	if (!Value.Check(schema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseProviderStatuses(input: unknown): ProviderStatus[] {
	const schema = Type.Array(providerStatusSchema);
	if (!Value.Check(schema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseProjectDomains(input: unknown): ProjectDomains {
	if (!Value.Check(projectDomainsSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseProjectConfig(input: unknown): ProjectConfig {
	if (!Value.Check(projectConfigSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseWorkspaceDirectoryListing(
	input: unknown,
): WorkspaceDirectoryListing {
	if (!Value.Check(workspaceDirectoryListingSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseSessionCatalog(input: unknown): SessionCatalog {
	if (!Value.Check(sessionCatalogSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseSessionTree(input: unknown): SessionTree {
	if (!Value.Check(sessionTreeSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseSessionSnapshot(input: unknown): SessionSnapshot {
	if (!Value.Check(sessionSnapshotSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseComposerCommands(input: unknown): ComposerCommand[] {
	const schema = Type.Array(composerCommandSchema);
	if (!Value.Check(schema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseAgentModelCatalog(input: unknown): AgentModelCatalog {
	if (!Value.Check(agentModelCatalogSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseUnityStatus(input: unknown): UnityStatus {
	if (!Value.Check(unityStatusSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

/** Generic counterpart to {@link parseUnityStatus} for the `ProjectStatus` wire shape. */
export function parseProjectStatus(input: unknown): ProjectStatus {
	if (!Value.Check(projectStatusSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseUnityOpenProjectResult(
	input: unknown,
): UnityOpenProjectResult {
	if (!Value.Check(unityOpenProjectResultSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseExtensions(input: unknown): Extensions {
	if (!Value.Check(extensionsSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseWebExtensionBundles(input: unknown): WebExtensionBundles {
	if (!Value.Check(webExtensionBundlesSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseFileRevertResult(input: unknown): FileRevertResult {
	if (!Value.Check(fileRevertResultSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseGitStatus(input: unknown): GitStatus {
	if (!Value.Check(gitStatusSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseGitCommitResult(input: unknown): GitCommitResult {
	if (!Value.Check(gitCommitResultSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseResourceCatalog(input: unknown): ResourceCatalog {
	if (!Value.Check(resourceCatalogSchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}

export function parseToolPolicy(input: unknown): ToolPolicy {
	if (!Value.Check(toolPolicySchema, input)) {
		throw new ProtocolValidationError('response', input);
	}
	return input;
}
