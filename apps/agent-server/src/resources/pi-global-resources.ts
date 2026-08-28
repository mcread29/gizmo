import {
	lstat,
	mkdir,
	readdir,
	readFile,
	realpath,
	rename,
	stat,
	writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import type { PiExtensionResource } from '@gizmo/protocol';

const home = homedir();
const agentDir = process.env.PI_CODING_AGENT_DIR
	? process.env.PI_CODING_AGENT_DIR.replace(/^~(?=$|[\\/])/, home)
	: join(home, '.pi', 'agent');
/** The Pi agent directory extensions and UI bundles are discovered from. */
export function piAgentDir(): string {
	return agentDir;
}

const enabledRoot = join(agentDir, 'extensions');
const disabledRoot = join(agentDir, 'extensions-disabled');

export async function listPiExtensions(): Promise<PiExtensionResource[]> {
	const [enabled, disabled] = await Promise.all([
		discoverExtensionEntries(enabledRoot, true),
		discoverExtensionEntries(disabledRoot, false),
	]);
	return [...enabled, ...disabled].sort((a, b) => a.name.localeCompare(b.name));
}

/** Paths of globally enabled Pi extensions, minus any ids the project disables. */
export async function enabledPiExtensionPaths(disabled?: ReadonlySet<string>) {
	return (await listPiExtensions())
		.filter((extension) => extension.enabled && !disabled?.has(extension.id))
		.map((extension) => extension.path);
}

export async function setPiExtensionEnabled(id: string, enabled: boolean) {
	const entry = (await listPiExtensions()).find(
		(candidate) => candidate.id === id,
	);
	if (!entry) throw new Error(`Unknown Pi extension: ${id}`);
	if (entry.enabled === enabled) return listPiExtensions();
	const sourceRoot = entry.enabled ? enabledRoot : disabledRoot;
	const targetRoot = enabled ? enabledRoot : disabledRoot;
	const source = safeChild(sourceRoot, entry.path);
	const target = join(targetRoot, basename(source));
	await mkdir(targetRoot, { recursive: true });
	try {
		await stat(target);
		throw new Error(`Cannot move extension: ${target} already exists`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	await rename(source, target);
	return listPiExtensions();
}

export async function readManagedSkill(path: string, allowedPaths: string[]) {
	const safe = await allowedSkillPath(path, allowedPaths);
	const content = await readFile(safe, 'utf8');
	if (Buffer.byteLength(content, 'utf8') > 1_000_000) {
		throw new Error('Skill files larger than 1 MB cannot be edited');
	}
	return { path: safe, content };
}

export async function writeManagedSkill(
	path: string,
	content: string,
	allowedPaths: string[],
) {
	const safe = await allowedSkillPath(path, allowedPaths);
	validateSkillMarkdown(content);
	const temporary = `${safe}.gizmo.tmp`;
	await writeFile(temporary, content, 'utf8');
	await rename(temporary, safe);
	return { path: safe, content };
}

async function discoverExtensionEntries(root: string, enabled: boolean) {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const resources: PiExtensionResource[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const path = join(root, entry.name);
		const loadable =
			(entry.isFile() && /\.(?:ts|js)$/.test(entry.name)) ||
			(entry.isDirectory() &&
				((await exists(join(path, 'index.ts'))) ||
					(await exists(join(path, 'index.js')))));
		if (!loadable) continue;
		resources.push({
			id: entry.name,
			name: entry.isDirectory()
				? entry.name
				: basename(entry.name, relativeExtension(entry.name)),
			path,
			enabled,
			kind: entry.isDirectory() ? 'directory' : 'file',
		});
	}
	return resources;
}

async function allowedSkillPath(path: string, allowedPaths: string[]) {
	const resolved = resolve(path);
	if (!allowedPaths.some((candidate) => resolve(candidate) === resolved)) {
		throw new Error('Skill path is outside the managed catalog');
	}
	if (basename(resolved) !== 'SKILL.md' && !resolved.endsWith('.md')) {
		throw new Error('Only Markdown skill files can be edited');
	}
	if (
		(await lstat(resolved)).isSymbolicLink() ||
		resolve(await realpath(resolved)) !== resolved
	) {
		throw new Error('Symlinked skill files cannot be edited');
	}
	return resolved;
}

function validateSkillMarkdown(content: string) {
	if (Buffer.byteLength(content, 'utf8') > 1_000_000) {
		throw new Error('Skill files cannot exceed 1 MB');
	}
	const frontmatter = content.match(
		/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
	)?.[1];
	if (!frontmatter) throw new Error('Skill Markdown needs YAML frontmatter');
	const name = frontmatter.match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
	const description = frontmatter
		.match(/^description:\s*([^\r\n]+)$/m)?.[1]
		?.trim();
	if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
		throw new Error(
			'Skill name must use lowercase letters, numbers, and hyphens',
		);
	}
	if (!description) throw new Error('Skill frontmatter needs a description');
}

function safeChild(root: string, path: string) {
	const resolvedRoot = resolve(root);
	const resolvedPath = resolve(path);
	if (
		dirname(resolvedPath) !== resolvedRoot ||
		relative(resolvedRoot, resolvedPath).startsWith(`..${sep}`)
	) {
		throw new Error('Extension path is outside its managed directory');
	}
	return resolvedPath;
}

function relativeExtension(name: string) {
	const match = name.match(/\.(?:ts|js|mts|mjs|cts|cjs)$/);
	return match?.[0] ?? '';
}

async function exists(path: string) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}
