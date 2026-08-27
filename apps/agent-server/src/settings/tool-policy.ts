import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
	builtInAgentTools,
	seededToolPolicy,
	type ToolPolicy,
} from '@gizmo/protocol';

/**
 * Gizmo's built-in tool policy, stored as Pi's `defaultTools` setting.
 *
 * Global state lives in the agent dir's `settings.json` and project overrides
 * in the workspace's `.pi/settings.json`, exactly where Pi reads them, so the
 * files Gizmo writes are the same files `pi` itself would. Extension and SDK
 * custom tools are always enabled and are deliberately not part of this
 * policy.
 */

const settingsFileName = 'settings.json';
const projectConfigDir = '.pi';

interface SettingsFile {
	[key: string]: unknown;
}

function settingsPath(agentDir: string): string {
	return join(agentDir, settingsFileName);
}

function projectSettingsPath(cwd: string): string {
	return join(cwd, projectConfigDir, settingsFileName);
}

async function readSettings(path: string): Promise<SettingsFile | undefined> {
	if (!existsSync(path)) return undefined;
	try {
		const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return undefined;
		}
		return parsed as SettingsFile;
	} catch {
		// A corrupt file is reported by Pi itself; never make it worse here.
		return undefined;
	}
}

/**
 * Read-modify-write against Pi's settings file. Pi locks its own writes; this
 * keeps the write surface to a single atomic rename so a concurrent `pi`
 * process sees either the old or the new file, never a partial one.
 */
async function updateSettings(
	path: string,
	update: (settings: SettingsFile) => SettingsFile | undefined,
): Promise<void> {
	const current = (await readSettings(path)) ?? {};
	const next = update(current);
	if (next === undefined) return;
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.gizmo.tmp`;
	await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
	await rename(temporary, path);
}

function normalizeTools(tools: readonly string[]): string[] {
	return [...new Set(tools)].filter((tool) =>
		(builtInAgentTools as readonly string[]).includes(tool),
	);
}

/**
 * Writes the seed when the global file exists but predates tool policy, or
 * when there is no global file at all. An explicit Pi default (every built-in)
 * is preserved: only an *absent* `defaultTools` key is seeded.
 */
export async function seedGlobalToolPolicy(agentDir: string): Promise<void> {
	const path = settingsPath(agentDir);
	if (!existsSync(path)) {
		await updateSettings(path, (settings) => ({
			...settings,
			defaultTools: [...seededToolPolicy],
		}));
		return;
	}
	await updateSettings(path, (settings) =>
		'defaultTools' in settings
			? undefined
			: { ...settings, defaultTools: [...seededToolPolicy] },
	);
}

export async function writeGlobalToolPolicy(
	agentDir: string,
	tools: readonly string[],
): Promise<void> {
	await updateSettings(settingsPath(agentDir), (settings) => ({
		...settings,
		defaultTools: normalizeTools(tools),
	}));
}

export async function writeProjectToolPolicy(
	cwd: string,
	tools: readonly string[] | null,
): Promise<void> {
	const path = projectSettingsPath(cwd);
	if (tools === null) {
		// An override file left with nothing in it is noise; drop it entirely.
		const cleared = await readSettings(path);
		if (!cleared) return;
		const { defaultTools: _removed, ...rest } = cleared;
		if (Object.keys(rest).length === 0) {
			await rm(path, { force: true });
			return;
		}
		await updateSettings(path, () => rest);
		return;
	}
	await updateSettings(path, (settings) => ({
		...settings,
		defaultTools: normalizeTools(tools),
	}));
}

export interface ReadToolPolicyOptions {
	/** Workspace the policy is resolved for; defaults to global-only. */
	cwd?: string;
	agentDir: string;
	/**
	 * Whether the workspace's `.pi/settings.json` applies. Pi applies project
	 * settings only to trusted projects; callers without a trust decision
	 * should omit this and Pi's trusted-by-default applies (Gizmo's normal
	 * mode). Pi Web passes its resolved trust decision.
	 */
	projectTrusted?: boolean;
}

export async function readToolPolicy(
	options: ReadToolPolicyOptions,
): Promise<ToolPolicy> {
	const { cwd, agentDir, projectTrusted } = options;
	await seedGlobalToolPolicy(agentDir);

	const global = await readSettings(settingsPath(agentDir));
	const globalTools = Array.isArray(global?.defaultTools)
		? normalizeTools(global.defaultTools as string[])
		: null;

	let project: string[] | null = null;
	let projectApplied = false;
	if (cwd) {
		const projectSettings = await readSettings(projectSettingsPath(cwd));
		project = Array.isArray(projectSettings?.defaultTools)
			? normalizeTools(projectSettings.defaultTools as string[])
			: null;
		projectApplied = project !== null && projectTrusted !== false;
	}

	const effective =
		projectApplied && project
			? project
			: (globalTools ?? [...builtInAgentTools]);

	return {
		builtIn: [...builtInAgentTools],
		global: globalTools,
		project,
		effective,
		projectApplied,
	};
}
