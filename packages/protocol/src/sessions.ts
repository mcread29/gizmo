import { Type, type Static } from 'typebox';

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
		/**
		 * The turn stopped without finishing — aborted, or ended in a provider
		 * error. Its text and tool calls are whatever arrived before it died.
		 */
		interrupted: Type.Optional(Type.Boolean()),
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
		/** The event id the snapshot is current as of; later events are live news. */
		lastEventId: Type.Optional(Type.Integer({ minimum: 0 })),
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
		/** The model's context limit, when it reports one. */
		contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
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
					/** The model's context limit, when it reports one. */
					contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
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
