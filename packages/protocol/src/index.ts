import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

export const protocolVersion = 18 as const;

const sessionTitleLimit = 48;

export function sessionTitle(input: string): string {
	const title = input.trim();
	if (!title) return 'New session';
	return title.length > sessionTitleLimit
		? `${title.slice(0, sessionTitleLimit - 1)}…`
		: title;
}

export const agentToolPolicy = {
	tools: ['read', 'edit', 'write', 'git_status'],
	approvals: false,
	extensions: false,
} as const;

export interface AgentIdentity {
	name: string;
	version: string;
	capabilities: readonly string[];
}

const envelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};

const eventEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	eventId: Type.Integer({ minimum: 1 }),
	sessionId: Type.String({ minLength: 1 }),
};

const responseEnvelope = {
	protocolVersion: Type.Literal(protocolVersion),
	requestId: Type.String({ minLength: 1 }),
};

export const workspaceProfileExtensionSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 64 }),
		root: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type WorkspaceIntegration = Static<
	typeof workspaceProfileExtensionSchema
>;

export const sessionOptionsSchema = Type.Object(
	{
		cwd: Type.Optional(Type.String({ minLength: 1 })),
		integrations: Type.Optional(Type.Array(workspaceProfileExtensionSchema)),
		domainId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
	},
	{ additionalProperties: false },
);

export type SessionOptions = Static<typeof sessionOptionsSchema>;

export const toolCallViewSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		status: Type.Union([
			Type.Literal('running'),
			Type.Literal('complete'),
			Type.Literal('error'),
		]),
		statusText: Type.String(),
		/** Arguments the agent called the tool with. */
		input: Type.Optional(Type.Unknown()),
		result: Type.Optional(Type.Unknown()),
	},
	{ additionalProperties: false },
);

export type ToolCallView = Static<typeof toolCallViewSchema>;

export const conversationAttachmentSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1, maxLength: 255 }),
		mimeType: Type.String({ minLength: 1, maxLength: 127 }),
		size: Type.Integer({ minimum: 0 }),
		/** Base64 image bytes, present when the attachment can be previewed. */
		data: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type ConversationAttachment = Static<
	typeof conversationAttachmentSchema
>;

export const conversationMessageSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
		content: Type.String(),
		/** Model reasoning, when the provider exposes it in readable form. */
		reasoning: Type.Optional(Type.String()),
		/**
		 * The provider withheld the reasoning and returned only an opaque
		 * payload, so there is nothing to show even though the model did think.
		 */
		reasoningRedacted: Type.Optional(Type.Boolean()),
		createdAt: Type.Integer({ minimum: 0 }),
		complete: Type.Boolean(),
		tools: Type.Array(toolCallViewSchema),
		attachments: Type.Optional(Type.Array(conversationAttachmentSchema)),
	},
	{ additionalProperties: false },
);

export type ConversationMessage = Static<typeof conversationMessageSchema>;

export const sessionUsageSchema = Type.Object(
	{
		input: Type.Integer({ minimum: 0 }),
		output: Type.Integer({ minimum: 0 }),
		cacheRead: Type.Integer({ minimum: 0 }),
		cacheWrite: Type.Integer({ minimum: 0 }),
		/** Everything the next request has to re-send, in tokens. */
		contextUsed: Type.Integer({ minimum: 0 }),
		/** The model's limit, when it reports one. */
		contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
		/** Cost of the thread so far, in US dollars. */
		cost: Type.Number({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type SessionUsage = Static<typeof sessionUsageSchema>;

export const compactionPolicySchema = Type.Object(
	{
		enabled: Type.Boolean(),
		fillPercent: Type.Integer({ minimum: 10, maximum: 95 }),
		retainPercent: Type.Integer({ minimum: 5, maximum: 90 }),
	},
	{ additionalProperties: false },
);

export type CompactionPolicy = Static<typeof compactionPolicySchema>;

export const agentAttachmentSchema = Type.Object(
	{
		name: Type.String({ minLength: 1, maxLength: 255 }),
		mimeType: Type.String({ minLength: 1, maxLength: 127 }),
		/** Base64-encoded file bytes. */
		data: Type.String({ minLength: 1, maxLength: 14_000_000 }),
	},
	{ additionalProperties: false },
);

export type AgentAttachment = Static<typeof agentAttachmentSchema>;

export const sessionTreeEntrySchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		parentId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
		kind: Type.Union([
			Type.Literal('user'),
			Type.Literal('assistant'),
			Type.Literal('tool'),
			Type.Literal('compaction'),
			Type.Literal('branch-summary'),
			Type.Literal('model-change'),
			Type.Literal('thinking-change'),
			Type.Literal('other'),
		]),
		/** One line for the row. */
		summary: Type.String(),
		/** Full text, for copying. */
		detail: Type.Optional(Type.String()),
		label: Type.Optional(Type.String()),
		createdAt: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type SessionTreeEntry = Static<typeof sessionTreeEntrySchema>;

export const sessionTreeSchema = Type.Object(
	{
		entries: Type.Array(sessionTreeEntrySchema),
		/** Where the next message will be appended. Null before any entry. */
		leafId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
	},
	{ additionalProperties: false },
);

export type SessionTree = Static<typeof sessionTreeSchema>;

export const agentSessionSummarySchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		title: Type.String({ minLength: 1 }),
		workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		domainId: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
		integrations: Type.Optional(
			Type.Array(
				Type.Object(
					{
						id: Type.String({ minLength: 1, maxLength: 64 }),
						root: Type.String({ minLength: 1 }),
					},
					{ additionalProperties: false },
				),
			),
		),
		/** @deprecated Read old session catalogs only. */
		projectPath: Type.Optional(Type.String({ minLength: 1 })),
		createdAt: Type.Integer({ minimum: 0 }),
		lastActiveAt: Type.Integer({ minimum: 0 }),
		messageCount: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type AgentSessionSummary = Static<typeof agentSessionSummarySchema>;

export const sessionCatalogSchema = Type.Object(
	{
		sessions: Type.Array(agentSessionSummarySchema),
		lastSessionId: Type.Optional(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type SessionCatalog = Static<typeof sessionCatalogSchema>;

export const sessionSnapshotSchema = Type.Object(
	{
		session: agentSessionSummarySchema,
		messages: Type.Array(conversationMessageSchema),
	},
	{ additionalProperties: false },
);

export type SessionSnapshot = Static<typeof sessionSnapshotSchema>;

export const agentModelOptionSchema = Type.Object(
	{
		provider: Type.String({ minLength: 1 }),
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		reasoning: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export type AgentModelOption = Static<typeof agentModelOptionSchema>;

export const agentModelCatalogSchema = Type.Object(
	{
		current: Type.Optional(
			Type.Object(
				{
					provider: Type.String({ minLength: 1 }),
					id: Type.String({ minLength: 1 }),
					thinkingLevel: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
		models: Type.Array(agentModelOptionSchema),
		thinkingLevels: Type.Array(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type AgentModelCatalog = Static<typeof agentModelCatalogSchema>;

const unityCliMessageSchema = Type.Object(
	{
		code: Type.String(),
		message: Type.String(),
		file: Type.Optional(Type.String()),
		line: Type.Optional(Type.Integer({ minimum: 1 })),
		column: Type.Optional(Type.Integer({ minimum: 1 })),
	},
	{ additionalProperties: false },
);

export const unityProjectSchema = Type.Object(
	{
		title: Type.String({ minLength: 1 }),
		path: Type.String({ minLength: 1 }),
		version: Type.Optional(Type.String()),
		lastModified: Type.Optional(Type.Integer({ minimum: 0 })),
		isFavorite: Type.Boolean(),
		buildTarget: Type.Optional(Type.String()),
		renderPipeline: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type UnityProject = Static<typeof unityProjectSchema>;

export const projectSkillSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 200 }),
		enabled: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export const workspaceProfileSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 64 }),
		name: Type.String({ minLength: 1, maxLength: 80 }),
		source: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
		base: Type.Optional(
			Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
		),
		extensions: Type.Array(workspaceProfileExtensionSchema),
		/** Overrides of global skill enablement for this profile. */
		skills: Type.Optional(Type.Array(projectSkillSchema)),
		tools: Type.Optional(
			Type.Object(
				{
					mode: Type.Union([
						Type.Literal('default'),
						Type.Literal('default-plus-extension'),
					]),
				},
				{ additionalProperties: false },
			),
		),
		prompt: Type.Optional(
			Type.Object(
				{
					mode: Type.Union([
						Type.Literal('pi-default'),
						Type.Literal('default-plus-extension-fragments'),
					]),
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);

export const workspaceProfilesSchema = Type.Object(
	{
		version: Type.Literal(1),
		activeProfileId: Type.String({ minLength: 1, maxLength: 64 }),
		profiles: Type.Array(workspaceProfileSchema),
	},
	{ additionalProperties: false },
);

export type WorkspaceProfile = Static<typeof workspaceProfileSchema>;
export type WorkspaceProfiles = Static<typeof workspaceProfilesSchema>;

export const storedProjectSchema = Type.Object(
	{
		title: Type.String({ minLength: 1 }),
		path: Type.String({ minLength: 1 }),
		/** Compatibility alias for the active profile's extensions. */
		integrations: Type.Array(workspaceProfileExtensionSchema),
		activeProfileId: Type.Optional(
			Type.String({ minLength: 1, maxLength: 64 }),
		),
		profiles: Type.Optional(Type.Array(workspaceProfileSchema)),
		/** Per-workspace overrides of each skill's global enablement. */
		skills: Type.Optional(Type.Array(projectSkillSchema)),
		addedAt: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type StoredProject = Static<typeof storedProjectSchema>;
export type ProjectSkill = Static<typeof projectSkillSchema>;

export const projectDomainsSchema = Type.Object(
	{
		domains: Type.Array(
			Type.Object(
				{
					id: Type.String({ minLength: 1, maxLength: 64 }),
					name: Type.String({ minLength: 1, maxLength: 64 }),
					detected: Type.Boolean(),
					root: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
		profiles: Type.Optional(Type.Array(workspaceProfileSchema)),
	},
	{ additionalProperties: false },
);

export type ProjectDomains = Static<typeof projectDomainsSchema>;

export const resourceScopeSchema = Type.Union([
	Type.Literal('global'),
	Type.Literal('project'),
]);

export type ResourceScope = Static<typeof resourceScopeSchema>;

/**
 * A skill Gizmo knows about. Discovery is global-first: every skill found on
 * disk is installed globally, and enablement is decided separately so a new
 * skill never starts influencing sessions on its own.
 */
export const skillResourceSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 200 }),
		name: Type.String({ minLength: 1, maxLength: 200 }),
		description: Type.String({ maxLength: 2000 }),
		scope: resourceScopeSchema,
		path: Type.String({ minLength: 1 }),
		source: Type.String({ minLength: 1 }),
		installed: Type.Boolean(),
		enabledGlobally: Type.Boolean(),
		/** Effective state for the workspace the catalog was requested for. */
		enabled: Type.Boolean(),
		/** Present when the workspace overrides the global enablement. */
		override: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false },
);

export type SkillResource = Static<typeof skillResourceSchema>;

/** Read-only companion resources: AGENTS.md files and prompt templates. */
export const agentResourceSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 400 }),
		name: Type.String({ minLength: 1, maxLength: 200 }),
		description: Type.Optional(Type.String({ maxLength: 2000 })),
		scope: resourceScopeSchema,
		path: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type AgentResource = Static<typeof agentResourceSchema>;

export const resourceCatalogSchema = Type.Object(
	{
		/** Absolute path of the workspace the effective state was resolved for. */
		workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		skills: Type.Array(skillResourceSchema),
		agentsFiles: Type.Array(agentResourceSchema),
		prompts: Type.Array(agentResourceSchema),
		diagnostics: Type.Array(Type.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);

export type ResourceCatalog = Static<typeof resourceCatalogSchema>;

export const workspaceDirectoryListingSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		parent: Type.Optional(Type.String({ minLength: 1 })),
		directories: Type.Array(
			Type.Object(
				{
					name: Type.String({ minLength: 1 }),
					path: Type.String({ minLength: 1 }),
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);

export type WorkspaceDirectoryListing = Static<
	typeof workspaceDirectoryListingSchema
>;

export const unityStatusSchema = Type.Object(
	{
		state: Type.Union([
			Type.Literal('connected'),
			Type.Literal('disconnected'),
			Type.Literal('unavailable'),
			Type.Literal('error'),
		]),
		ok: Type.Boolean(),
		command: Type.Array(Type.String()),
		exitCode: Type.Union([Type.Integer(), Type.Null()]),
		durationMs: Type.Integer({ minimum: 0 }),
		instances: Type.Array(Type.Record(Type.String(), Type.Unknown())),
		errors: Type.Array(unityCliMessageSchema),
		warnings: Type.Array(unityCliMessageSchema),
		stderr: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type UnityStatus = Static<typeof unityStatusSchema>;

/**
 * Generic wire shape for any extension that declares `hasProjectStatus`.
 * Structurally identical to `UnityStatus` — Unity is simply the extension
 * that happens to populate it today — kept as a distinct export so client
 * code names the capability, not the extension that first implemented it.
 */
export const projectStatusSchema = unityStatusSchema;
export type ProjectStatus = UnityStatus;

export const extensionOperationSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		mutates: Type.Boolean(),
		requiresConfirmation: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export type ExtensionOperation = Static<typeof extensionOperationSchema>;

export const extensionDescriptorSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		name: Type.String({ minLength: 1, maxLength: 128 }),
		version: Type.String({ minLength: 1, maxLength: 64 }),
		apiVersion: Type.Integer({ minimum: 1 }),
		capabilities: Type.Array(Type.String({ minLength: 1, maxLength: 128 })),
		operations: Type.Array(extensionOperationSchema),
	},
	{ additionalProperties: false },
);

export type ExtensionDescriptor = Static<typeof extensionDescriptorSchema>;

export const extensionsSchema = Type.Object(
	{
		extensions: Type.Array(extensionDescriptorSchema),
	},
	{ additionalProperties: false },
);

export type Extensions = Static<typeof extensionsSchema>;

/**
 * One runtime-loadable web extension bundle. `code` is a standalone ES module
 * exporting `gizmoWebExtension`; the app imports it through a real runtime
 * `import()` of a blob URL, which its own bundler never had to resolve.
 */
export const webExtensionBundleSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		code: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type WebExtensionBundle = Static<typeof webExtensionBundleSchema>;

export const webExtensionBundlesSchema = Type.Object(
	{
		bundles: Type.Array(webExtensionBundleSchema),
		/** Extensions that declared a web bundle Gizmo could not load. */
		diagnostics: Type.Array(Type.String()),
	},
	{ additionalProperties: false },
);

export type WebExtensionBundles = Static<typeof webExtensionBundlesSchema>;

export const fileRevertResultSchema = Type.Object(
	{
		file: Type.String({ minLength: 1 }),
		reverted: Type.Boolean(),
		reason: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type FileRevertResult = Static<typeof fileRevertResultSchema>;

export const gitFileStatusSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		originalPath: Type.Optional(Type.String({ minLength: 1 })),
		index: Type.String({ minLength: 1, maxLength: 1 }),
		workingTree: Type.String({ minLength: 1, maxLength: 1 }),
	},
	{ additionalProperties: false },
);

export type GitFileStatus = Static<typeof gitFileStatusSchema>;

export const gitStatusSchema = Type.Object(
	{
		rootPath: Type.String({ minLength: 1 }),
		branch: Type.String({ minLength: 1 }),
		clean: Type.Boolean(),
		files: Type.Array(gitFileStatusSchema),
	},
	{ additionalProperties: false },
);

export type GitStatus = Static<typeof gitStatusSchema>;

export const gitCommitResultSchema = Type.Object(
	{
		rootPath: Type.String({ minLength: 1 }),
		commit: Type.String({ minLength: 1 }),
		message: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type GitCommitResult = Static<typeof gitCommitResultSchema>;

export const unityOpenProjectResultSchema = Type.Object(
	{
		state: Type.Union([
			Type.Literal('opened'),
			Type.Literal('already_open'),
			Type.Literal('error'),
		]),
		ok: Type.Boolean(),
		command: Type.Array(Type.String()),
		exitCode: Type.Union([Type.Integer(), Type.Null()]),
		durationMs: Type.Integer({ minimum: 0 }),
		data: Type.Unknown(),
		errors: Type.Array(unityCliMessageSchema),
		warnings: Type.Array(unityCliMessageSchema),
		stderr: Type.Optional(Type.String()),
		status: Type.Optional(unityStatusSchema),
	},
	{ additionalProperties: false },
);

export type UnityOpenProjectResult = Static<
	typeof unityOpenProjectResultSchema
>;

export const providerStatusSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		authenticated: Type.Boolean(),
		source: Type.Optional(Type.String({ minLength: 1 })),
		credentialType: Type.Optional(
			Type.Union([Type.Literal('api_key'), Type.Literal('oauth')]),
		),
		supportsApiKey: Type.Boolean(),
		supportsOAuth: Type.Boolean(),
		modelCount: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export type ProviderStatus = Static<typeof providerStatusSchema>;

export const agentRequestSchema = Type.Union([
	Type.Object(
		{ ...envelope, type: Type.Literal('providers.list') },
		{ additionalProperties: false },
	),
	Type.Object(
		{ ...envelope, type: Type.Literal('providers.import-pi-auth') },
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('attachment.read'),
			sessionId: Type.String({ minLength: 1 }),
			attachmentId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('attachment.reveal'),
			sessionId: Type.String({ minLength: 1 }),
			attachmentId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.list'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.create'),
			options: sessionOptionsSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.resume'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.rename'),
			sessionId: Type.String({ minLength: 1 }),
			title: Type.String({ minLength: 1, maxLength: 200 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.prompt'),
			sessionId: Type.String({ minLength: 1 }),
			text: Type.String({ minLength: 1 }),
			compaction: Type.Optional(compactionPolicySchema),
			attachments: Type.Optional(
				Type.Array(agentAttachmentSchema, { maxItems: 8 }),
			),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.compact'),
			sessionId: Type.String({ minLength: 1 }),
			compaction: compactionPolicySchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.reload'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.steer'),
			sessionId: Type.String({ minLength: 1 }),
			text: Type.String({ minLength: 1 }),
			attachments: Type.Optional(
				Type.Array(agentAttachmentSchema, { maxItems: 8 }),
			),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.abort'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('confirmation.resolve'),
			sessionId: Type.String({ minLength: 1 }),
			confirmationId: Type.String({ minLength: 1 }),
			accepted: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.tree'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.branch'),
			sessionId: Type.String({ minLength: 1 }),
			/** Null rewinds past the first entry, to re-run the opening prompt. */
			entryId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.label'),
			sessionId: Type.String({ minLength: 1 }),
			entryId: Type.String({ minLength: 1 }),
			/** Omitted clears the label. */
			label: Type.Optional(Type.String({ maxLength: 120 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('session.delete'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('model.catalog'),
			sessionId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('model.select'),
			sessionId: Type.String({ minLength: 1 }),
			provider: Type.String({ minLength: 1 }),
			modelId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('thinking.select'),
			sessionId: Type.String({ minLength: 1 }),
			level: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.list'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.detect'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.browse'),
			path: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.search'),
			query: Type.String(),
			root: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.add'),
			projectPath: Type.String({ minLength: 1 }),
			integrations: Type.Array(workspaceProfileExtensionSchema),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.profiles.save'),
			projectPath: Type.String({ minLength: 1 }),
			profiles: workspaceProfilesSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.remove'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.status'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.watch'),
			sessionId: Type.String({ minLength: 1 }),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.open'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.extensions'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extensions.web'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.extension.invoke'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
			operation: Type.String({ minLength: 1, maxLength: 128 }),
			input: Type.Optional(Type.Unknown()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.list'),
			/** Omitted lists global state only. */
			workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.global'),
			skillId: Type.String({ minLength: 1, maxLength: 200 }),
			installed: Type.Optional(Type.Boolean()),
			enabled: Type.Optional(Type.Boolean()),
			workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.project'),
			workspacePath: Type.String({ minLength: 1 }),
			skillId: Type.String({ minLength: 1, maxLength: 200 }),
			/** Null clears the override so the global setting applies again. */
			enabled: Type.Union([Type.Boolean(), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('git.commit-message'),
			sessionId: Type.String({ minLength: 1 }),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('file.revert'),
			projectPath: Type.String({ minLength: 1 }),
			file: Type.String({ minLength: 1 }),
			patch: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
]);

export type AgentRequest = Static<typeof agentRequestSchema>;

export const agentResponseSchema = Type.Union([
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.success'),
			sessionId: Type.Optional(Type.String({ minLength: 1 })),
			result: Type.Optional(Type.Unknown()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...responseEnvelope,
			type: Type.Literal('response.error'),
			code: Type.String({ minLength: 1 }),
			message: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
]);

export type AgentResponse = Static<typeof agentResponseSchema>;

export const sessionStateSchema = Type.Union([
	Type.Literal('idle'),
	Type.Literal('streaming'),
	Type.Literal('error'),
]);

export type SessionState = Static<typeof sessionStateSchema>;

export const agentEventSchema = Type.Union([
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.created'),
			title: Type.String(),
			domains: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
			tools: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
			model: Type.Optional(
				Type.Object(
					{
						provider: Type.String({ minLength: 1 }),
						id: Type.String({ minLength: 1 }),
						thinkingLevel: Type.String({ minLength: 1 }),
					},
					{ additionalProperties: false },
				),
			),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.state'),
			state: sessionStateSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.compaction'),
			active: Type.Boolean(),
			reason: Type.Union([
				Type.Literal('manual'),
				Type.Literal('threshold'),
				Type.Literal('overflow'),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('confirmation.requested'),
			confirmationId: Type.String({ minLength: 1 }),
			kind: Type.Literal('stop_play_mode_for_compile'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('project.status.changed'),
			projectPath: Type.String({ minLength: 1 }),
			status: unityStatusSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('project.extensions.changed'),
			projectPath: Type.String({ minLength: 1 }),
			extensions: Type.Array(extensionDescriptorSchema),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.started'),
			messageId: Type.String({ minLength: 1 }),
			role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
			createdAt: Type.Integer({ minimum: 0 }),
			attachments: Type.Optional(Type.Array(conversationAttachmentSchema)),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.delta'),
			messageId: Type.String({ minLength: 1 }),
			delta: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('session.usage'),
			usage: sessionUsageSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.reasoning'),
			messageId: Type.String({ minLength: 1 }),
			delta: Type.String(),
			redacted: Type.Optional(Type.Boolean()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('message.completed'),
			messageId: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.started'),
			messageId: Type.String({ minLength: 1 }),
			toolCallId: Type.String({ minLength: 1 }),
			toolName: Type.String({ minLength: 1 }),
			input: Type.Unknown(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.updated'),
			toolCallId: Type.String({ minLength: 1 }),
			message: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('tool.completed'),
			toolCallId: Type.String({ minLength: 1 }),
			result: Type.Unknown(),
			isError: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...eventEnvelope,
			type: Type.Literal('error'),
			code: Type.String({ minLength: 1 }),
			message: Type.String({ minLength: 1 }),
			requestId: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
]);

export type AgentEvent = Static<typeof agentEventSchema>;

export class ProtocolValidationError extends Error {
	constructor(kind: 'request' | 'response' | 'event', input: unknown) {
		super(`Invalid agent protocol ${kind}`);
		this.name = 'ProtocolValidationError';
		this.cause = input;
	}
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
