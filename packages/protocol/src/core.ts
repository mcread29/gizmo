import { Type, type Static } from 'typebox';

export const protocolVersion = 25 as const;

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

/** Pi's built-in tools. Availability is governed by Pi's `defaultTools` setting. */
export const builtInAgentTools = [
	'read',
	'bash',
	'powershell',
	'edit',
	'write',
	'grep',
	'find',
	'ls',
] as const;

/**
 * Gizmo seeds this on first read so a fresh install keeps the no-shell
 * default instead of Pi's every-built-in default. Checking every box
 * reproduces Pi's default, so seeding loses nothing.
 */
export const seededToolPolicy = ['read', 'edit', 'write'] as const;

/**
 * Which built-in tools a session starts with. Global comes from Pi's
 * `defaultTools` setting; a workspace may override it through project
 * settings. Extension and SDK custom tools are always enabled and are not
 * part of this policy.
 */
export const toolPolicySchema = Type.Object(
	{
		builtIn: Type.Array(Type.String()),
		/** Global setting; null means Pi's default (every built-in enabled). */
		global: Type.Union([Type.Array(Type.String()), Type.Null()]),
		/** Project override from `.pi/settings.json`; null means none. */
		project: Type.Union([Type.Array(Type.String()), Type.Null()]),
		/** What a new thread in this workspace actually starts with. */
		effective: Type.Array(Type.String()),
		/** Whether a project override applies (Pi's project-trust rules). */
		projectApplied: Type.Boolean(),
	},
	{ additionalProperties: false },
);

export type ToolPolicy = Static<typeof toolPolicySchema>;

export interface AgentIdentity {
	name: string;
	version: string;
	capabilities: readonly string[];
}
