import type { ResourceCatalog, RegistryStatus } from '@gizmo/protocol';
import { fakeAgentsFiles, fakeDomains, fakePrompts } from './fixtures';
import type { FakeProjectCapability } from './projects';
import type { FakeClientState } from './state';

const emptyRegistry = (): RegistryStatus => ({
	home: '/home/dev/.gizmo/registries',
	registries: [],
});

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

	async registryStatus() {
		return emptyRegistry();
	}

	async registryAdd(url: string): Promise<RegistryStatus> {
		return {
			home: '/home/dev/.gizmo/registries',
			registries: [
				{
					name: url
						.split('/')
						.pop()!
						.replace(/\.git$/, ''),
					url,
					addedAt: Date.now(),
					extensions: [
						{
							id: 'ask-user',
							name: 'Ask the user',
							description: 'Multiple-choice questions with a native chat card',
							linked: false,
						},
					],
				},
			],
		};
	}

	async registryUpdate() {
		return emptyRegistry();
	}

	async registryRemove() {
		return emptyRegistry();
	}

	async registryLink() {
		return emptyRegistry();
	}

	async registryUnlink() {
		return emptyRegistry();
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
