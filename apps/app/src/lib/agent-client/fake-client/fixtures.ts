import type {
	AgentModelCatalog,
	AgentResource,
	ExtensionDescriptor,
	ProviderStatus,
	SkillResource,
	StoredProject,
	ProjectStatus,
} from '@gizmo/protocol';

export const fakeProviders: ProviderStatus[] = [
	{
		id: 'openai-codex',
		name: 'OpenAI Codex',
		authenticated: true,
		source: 'OAuth',
		credentialType: 'oauth',
		supportsApiKey: false,
		supportsOAuth: true,
		modelCount: 3,
	},
];

export const fakeModels = [
	{
		provider: 'openai-codex',
		id: 'gpt-5.6-sol',
		name: 'GPT-5.6 Sol',
		reasoning: true,
	},
	{
		provider: 'openai-codex',
		id: 'gpt-5.6-terra',
		name: 'GPT-5.6 Terra',
		reasoning: true,
	},
] satisfies AgentModelCatalog['models'];

export const fakeThinkingLevels = ['off', 'low', 'medium', 'high', 'xhigh'];

export const fakeDomains = [
	{ id: 'unity', name: 'Unity', root: '.' },
	{ id: 'svelte', name: 'Svelte', root: '.' },
	{ id: 'git', name: 'Git', root: '.' },
	{ id: 'activity', name: 'Activity', root: '.' },
	{ id: 'skill-authoring', name: 'Skill Authoring', root: '.' },
];

export function createFakeProjects(): StoredProject[] {
	return [
		{
			title: 'ThirdPersonSandbox',
			path: '/projects/ThirdPersonSandbox',
			integrations: [
				{ id: 'unity', root: '.' },
				{ id: 'svelte', root: '.' },
				{ id: 'git', root: '.' },
			],
			addedAt: 1,
		},
		{
			title: 'RenderingPlayground',
			path: '/projects/RenderingPlayground',
			integrations: [{ id: 'unity', root: '.' }],
			addedAt: 0,
		},
	];
}

export function createFakeSkills(): SkillResource[] {
	return [
		{
			id: 'global/svelte-code-writer',
			name: 'svelte-code-writer',
			description: 'Svelte 5 documentation lookup and component analysis.',
			scope: 'global',
			path: '/home/dev/.gizmo/skills/svelte-code-writer/SKILL.md',
			source: 'user',
			installed: true,
			enabledGlobally: true,
			enabled: true,
		},
		{
			id: 'global/unity-shader-review',
			name: 'unity-shader-review',
			description: 'Review shader graphs and URP materials before a build.',
			scope: 'global',
			path: '/home/dev/.gizmo/skills/unity-shader-review/SKILL.md',
			source: 'user',
			installed: true,
			enabledGlobally: false,
			enabled: false,
		},
		{
			id: 'project/release-checklist',
			name: 'release-checklist',
			description: 'Steps this workspace follows before tagging a release.',
			scope: 'project',
			path: '/projects/ThirdPersonSandbox/.gizmo/skills/release-checklist/SKILL.md',
			source: 'project',
			installed: true,
			enabledGlobally: false,
			enabled: false,
		},
	];
}

export const fakeAgentsFiles: AgentResource[] = [
	{
		id: 'agents:/home/dev/.gizmo/AGENTS.md',
		name: 'AGENTS.md',
		description: 'Personal defaults applied to every workspace.',
		scope: 'global',
		path: '/home/dev/.gizmo/AGENTS.md',
	},
	{
		id: 'agents:/projects/ThirdPersonSandbox/AGENTS.md',
		name: 'AGENTS.md',
		description: 'Conventions for this workspace.',
		scope: 'project',
		path: '/projects/ThirdPersonSandbox/AGENTS.md',
	},
];

export const fakePrompts: AgentResource[] = [
	{
		id: 'prompt:/home/dev/.gizmo/prompts/review.md',
		name: 'review',
		description: 'Review staged changes.',
		scope: 'global',
		path: '/home/dev/.gizmo/prompts/review.md',
	},
];

export function fakeStatus(projectPath: string, open: boolean): ProjectStatus {
	return {
		state: open ? 'connected' : 'disconnected',
		ok: true,
		command: ['unity', 'status', '--project-path', projectPath],
		exitCode: 0,
		durationMs: 1,
		instances: open
			? [
					{
						projectPath,
						version: '6000.3.7f1',
						port: 6400,
						pid: 42,
						state: 'ready',
					},
				]
			: [],
		errors: [],
		warnings: [],
	};
}

export const fakeEditFile = 'Assets/Scripts/PlayerController.cs';

export const fakeEditResult = {
	ok: true,
	file: fakeEditFile,
	compilationPending: true,
	compilationPaths: [fakeEditFile],
	patch: [
		`--- a/${fakeEditFile}`,
		`+++ b/${fakeEditFile}`,
		'@@ -12,6 +12,7 @@',
		' public class PlayerController : MonoBehaviour',
		' {',
		'-    [SerializeField] private float moveSpeed = 4f;',
		'+    [SerializeField] private float moveSpeed = 6f;',
		'+    [SerializeField] private float sprintMultiplier = 1.6f;',
		' ',
		'     private CharacterController controller;',
		' }',
	].join('\n'),
	errors: [],
	warnings: [],
};

export const fakeConsoleExtension: ExtensionDescriptor = {
	id: 'unity',
	name: 'Unity',
	version: '0.1.0',
	apiVersion: 1,
	capabilities: ['unity.console'],
	operations: [
		{ id: 'console.snapshot', mutates: false, requiresConfirmation: false },
	],
};

export const fakeConsoleEntries = [
	{ level: 'log', message: 'Reloading assemblies for play mode' },
	{
		level: 'warn',
		message: 'Shader "Custom/Water" has no fallback for OpenGL ES 2.0',
		file: 'Assets/Shaders/Water.shader',
		line: 42,
	},
	{ level: 'log', message: 'PlayerController awake on ThirdPerson prefab' },
	{
		level: 'error',
		message:
			'NullReferenceException: Object reference not set to an instance of an object',
		file: fakeEditFile,
		line: 58,
		column: 13,
	},
];
