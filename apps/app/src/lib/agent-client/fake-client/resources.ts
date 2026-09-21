import type {
	AppUpdateStatus,
	InstructionFile,
	InstructionTarget,
	ResourceCatalog,
	RegistryCatalogEntry,
	RegistryStatus,
} from '@gizmo/protocol';
import { fakeAgentsFiles, fakeDomains, fakePrompts } from './fixtures';
import type { FakeProjectCapability } from './projects';
import type { FakeClientState } from './state';

const fakeRegistryExtensions = (): RegistryCatalogEntry[] => [
	{
		id: 'unity',
		name: 'Unity',
		description: 'Editor bridge and play controls',
		linked: true,
	},
	{
		id: 'svelte',
		name: 'Svelte',
		description: 'Component and route awareness',
		linked: true,
	},
	{
		id: 'git',
		name: 'Git',
		description: 'Branches, diffs, and commits',
		linked: true,
	},
	{
		id: 'ask-user',
		name: 'Ask the user',
		description: 'Multiple-choice questions with a native chat card',
		linked: false,
	},
	{
		id: 'codex',
		name: 'Codex',
		description: 'Hand a task to a second coding agent',
		linked: false,
	},
];

export class FakeResourceCapability {
	constructor(
		private readonly state: FakeClientState,
		private readonly projects: FakeProjectCapability,
	) {}

	async list(workspacePath?: string) {
		this.state.assertConnected();
		return this.catalog(workspacePath);
	}

	async setGlobalSkill(
		skillId: string,
		change: { installed?: boolean; enabled?: boolean },
		workspacePath?: string,
	) {
		const skill = this.skill(skillId);
		if (change.installed !== undefined) {
			skill.installed = change.installed;
			if (!change.installed) skill.enabledGlobally = false;
		}
		if (change.enabled !== undefined) {
			skill.enabledGlobally = change.enabled;
			if (change.enabled) skill.installed = true;
		}
		return this.catalog(workspacePath);
	}

	async readSkill(path: string) {
		return {
			path,
			content: '---\nname: example\ndescription: Example skill\n---\n',
		};
	}

	async writeSkill(path: string, content: string) {
		return { path, content };
	}

	async setGlobalExtension() {
		return this.catalog();
	}

	#instructions = new Map<string, string>();

	async readInstructions(
		target: InstructionTarget,
		workspacePath?: string,
	): Promise<InstructionFile> {
		const content = this.#instructions.get(`${target}:${workspacePath ?? ''}`);
		return {
			target,
			path: this.#instructionPath(target, workspacePath),
			content: content ?? '',
			exists: content !== undefined,
		};
	}

	async writeInstructions(
		target: InstructionTarget,
		content: string,
		workspacePath?: string,
	): Promise<InstructionFile> {
		this.#instructions.set(`${target}:${workspacePath ?? ''}`, content);
		return {
			target,
			path: this.#instructionPath(target, workspacePath),
			content,
			exists: true,
		};
	}

	#instructionPath(target: InstructionTarget, workspacePath?: string) {
		if (target === 'system-prompt') return '/home/dev/.gizmo/system-prompt.md';
		if (target === 'global-agents') return '/home/dev/.pi/agent/AGENTS.md';
		return `${workspacePath ?? '/home/dev/project'}/AGENTS.md`;
	}

	/** A release install with a newer tag published. */
	#appUpdate: AppUpdateStatus = {
		install: 'release',
		version: 'v0.1.7',
		root: '/home/dev/.gizmo/app/releases/v0.1.7',
		latest: 'v0.1.8',
		updateAvailable: true,
		checkedAt: 1_700_000_000_000,
		phase: 'idle',
	};

	async appUpdateStatus() {
		return this.#appUpdate;
	}

	async appUpdateStart(version?: string) {
		this.#appUpdate = {
			...this.#appUpdate,
			phase: 'installing',
			target: version ?? this.#appUpdate.latest ?? 'latest',
			message: 'Starting…',
		};
		return this.#appUpdate;
	}

	/** The one registry: Gizmo's extension repository, cloned locally. */
	#registry: RegistryStatus = {
		home: '/home/dev/.gizmo/registry',
		url: 'https://github.com/mcread29/gizmo-registry.git',
		commit: 'a1b2c3d',
		extensions: fakeRegistryExtensions(),
	};

	async registryStatus() {
		return this.#registry;
	}

	async registryUpdate() {
		this.#registry = { ...this.#registry, updateAvailable: false };
		return this.#registry;
	}

	async registryLink(id: string) {
		return this.#setLinked(id, true);
	}

	async registryUnlink(id: string) {
		return this.#setLinked(id, false);
	}

	#setLinked(id: string, linked: boolean): RegistryStatus {
		const extensions = this.#registry.extensions.map((extension) =>
			extension.id === id ? { ...extension, linked } : extension,
		);
		this.#registry = { ...this.#registry, extensions };
		return this.#registry;
	}

	async setGlobalGizmoExtension(extensionId: string, enabled: boolean) {
		if (enabled) this.state.disabledGizmoGlobally.delete(extensionId);
		else this.state.disabledGizmoGlobally.add(extensionId);
		for (const { path } of this.state.projects) {
			this.projects.syncIntegrations(path);
		}
		return this.catalog();
	}

	async setProjectSkill(
		workspacePath: string,
		skillId: string,
		enabled: boolean | null,
	) {
		this.skill(skillId);
		const overrides =
			this.state.skillOverrides.get(workspacePath) ??
			new Map<string, boolean>();
		if (enabled === null) overrides.delete(skillId);
		else overrides.set(skillId, enabled);
		this.state.skillOverrides.set(workspacePath, overrides);
		return this.catalog(workspacePath);
	}

	private skill(skillId: string) {
		const skill = this.state.skills.find(({ id }) => id === skillId);
		if (!skill) throw new Error(`Unknown skill: ${skillId}`);
		return skill;
	}

	private catalog(workspacePath?: string): ResourceCatalog {
		const overrides = workspacePath
			? this.state.skillOverrides.get(workspacePath)
			: undefined;
		return {
			...(workspacePath ? { workspacePath } : {}),
			skills: this.state.skills.map((skill) => {
				const override = overrides?.get(skill.id);
				return {
					...skill,
					enabled: skill.installed && (override ?? skill.enabledGlobally),
					...(override === undefined ? {} : { override }),
				};
			}),
			agentsFiles: fakeAgentsFiles,
			prompts: fakePrompts,
			gizmoExtensions: fakeDomains.map(({ id, name }) => ({
				id,
				name,
				enabled: !this.state.disabledGizmoGlobally.has(id),
			})),
			diagnostics: [],
		};
	}
}
