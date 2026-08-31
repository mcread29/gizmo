import { readFile } from 'node:fs/promises';
import type { ComposerCommand, CompactionPolicy } from '@gizmo/protocol';
import {
	activateExtensions,
	registeredExtensions,
} from '../extensions/registry';
import { createRunScriptTool } from '../scripts/run-script-tool';
import { extensionResourceRoots } from '../resources/extension-resources';
import { enabledPiExtensionPaths } from '../resources/pi-global-resources';
import {
	existingDirectories,
	existingFiles,
	resourceRoots,
} from '../resources/resource-paths';
import { ResourceCatalogService } from '../resources/resource-catalog';
import { defaultDataDir } from './session-repository';
import { gizmoModelRuntime } from './pi-model-runtime';
import type { PiSessionFactory } from './pi-agent-types';

// Kept as the default behind the facade; tests can still inject the same factory API.
export const createDefaultPiSession: PiSessionFactory = async (
	options,
	sessionManager,
	callbacks,
) => {
	const {
		createAgentSessionFromServices,
		createAgentSessionServices,
		getAgentDir,
		hasTrustRequiringProjectResources,
		ProjectTrustStore,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	const cwd = options.cwd ?? process.cwd();
	const piWebMode = process.env.GIZMO_PI_WEB === '1';
	const agentDir = piWebMode ? getAgentDir() : defaultDataDir();
	const modelRuntime = piWebMode ? undefined : await gizmoModelRuntime();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	let getSkillCommands: () => ComposerCommand[] = () => [];
	const confirm = (kind: string): Promise<boolean> => {
		if (kind !== 'stop_play_mode_for_compile') {
			throw new Error(`Unsupported confirmation: ${kind}`);
		}
		return callbacks.confirmStopPlayMode(cwd);
	};
	const activeDomains = await activateExtensions(
		{ workspacePath: cwd, confirm },
		options.integrations ??
			(options.domainId && options.domainId !== 'generic'
				? [{ id: options.domainId, root: '.' }]
				: []),
	);
	const customTools = [
		...activeDomains.tools,
		createRunScriptTool({ workspacePath: cwd }),
	];
	const catalog = new ResourceCatalogService();
	const [skillPaths, promptPaths, agentsFiles, fromExtensions, piExtensions] =
		await Promise.all([
			catalog.enabledSkillPaths(cwd),
			existingDirectories(resourceRoots(cwd).prompts),
			readAgentsFiles(cwd),
			extensionResourceRoots(registeredExtensions()),
			enabledPiExtensionPaths(new Set(options.disabledPiExtensions ?? [])),
		]);
	const resourceLoaderOptions = {
		noExtensions: true,
		additionalExtensionPaths: piExtensions,
		noSkills: true,
		additionalSkillPaths: skillPaths,
		noPromptTemplates: true,
		additionalPromptTemplatePaths: [...promptPaths, ...fromExtensions.prompts],
		noContextFiles: true,
		agentsFilesOverride: () => ({ agentsFiles }),
		...(activeDomains.systemPrompt
			? { systemPromptOverride: () => activeDomains.systemPrompt! }
			: {}),
	};
	const { session } = await (async () => {
		if (piWebMode) {
			const services = await createAgentSessionServices({
				cwd,
				agentDir,
				settingsManager,
				resourceLoaderOptions,
				resourceLoaderReloadOptions: {
					resolveProjectTrust: async () => {
						if (!hasTrustRequiringProjectResources(cwd)) return true;
						const saved = new ProjectTrustStore(agentDir).get(cwd);
						if (saved !== null) return saved;
						return settingsManager.getDefaultProjectTrust() === 'always';
					},
				},
			});
			getSkillCommands = () => skillCommands(services.resourceLoader);
			return createAgentSessionFromServices({
				services,
				sessionManager,
				customTools,
			});
		}

		const services = await createAgentSessionServices({
			cwd,
			agentDir,
			settingsManager,
			modelRuntime,
			resourceLoaderOptions,
		});
		getSkillCommands = () => skillCommands(services.resourceLoader);
		return createAgentSessionFromServices({
			services,
			customTools,
			sessionManager,
		});
	})();
	await session.bindExtensions({
		mode: 'json',
		uiContext: callbacks.extensionUi.context,
		onError: (error) =>
			console.error(
				`Pi extension error (${error.extensionPath}):`,
				error.error,
			),
	});
	return Object.assign(session, {
		domains: activeDomains.extensions.map(({ id }) => id),
		async generateCommitMessage(context: string) {
			if (!session.model) throw new Error('No model is selected');
			const message = await session.modelRuntime.completeSimple(
				session.model,
				{
					systemPrompt:
						'Write a concise Git commit message for the supplied changes. Return only the message: an imperative subject line, optionally followed by a blank line and a short explanatory body. Do not use Markdown fences or quotes.',
					messages: [{ role: 'user', content: context, timestamp: Date.now() }],
				},
				{ maxTokens: 300 },
			);
			if (message.stopReason === 'error') {
				throw new Error(
					message.errorMessage || 'Pi could not generate a commit message',
				);
			}
			const text = message.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('')
				.trim()
				.replace(/^```(?:text)?\s*|\s*```$/g, '')
				.trim();
			if (!text) throw new Error('Pi returned an empty commit message');
			return text;
		},
		configureCompaction(policy: CompactionPolicy) {
			const contextWindow = session.model?.contextWindow ?? 128_000;
			settingsManager.applyOverrides({
				compaction: {
					enabled: policy.enabled,
					reserveTokens: Math.round(
						contextWindow * (1 - policy.fillPercent / 100),
					),
					keepRecentTokens: Math.round(
						contextWindow * (policy.retainPercent / 100),
					),
					fullTurnBoundaries: true,
				},
			});
		},
		getCommands() {
			const extensionCommands = session.extensionRunner
				.getRegisteredCommands()
				.map((command) => ({
					name: command.invocationName,
					...(command.description ? { description: command.description } : {}),
					source: 'extension' as const,
				}));
			const prompts = session.promptTemplates.map((prompt) => ({
				name: prompt.name,
				...(prompt.description ? { description: prompt.description } : {}),
				source: 'prompt' as const,
			}));
			return [...extensionCommands, ...prompts, ...getSkillCommands()];
		},
		async getModelCatalog() {
			const models = await session.modelRuntime.getAvailable();
			return {
				...(session.model
					? {
							current: {
								provider: session.model.provider,
								id: session.model.id,
								thinkingLevel: session.thinkingLevel,
								...(session.model.contextWindow
									? { contextWindow: session.model.contextWindow }
									: {}),
							},
						}
					: {}),
				models: models
					.map((model) => ({
						provider: model.provider,
						id: model.id,
						name: model.name,
						reasoning: model.reasoning,
						...(model.contextWindow > 0
							? { contextWindow: model.contextWindow }
							: {}),
					}))
					.sort((left, right) =>
						`${left.provider}/${left.name}`.localeCompare(
							`${right.provider}/${right.name}`,
						),
					),
				thinkingLevels: session.getAvailableThinkingLevels(),
			};
		},
		async selectModel(provider: string, modelId: string) {
			const model = session.modelRuntime.getModel(provider, modelId);
			if (!model) throw new Error(`Unknown model: ${provider}/${modelId}`);
			await session.setModel(model);
		},
		selectThinkingLevel(level: string) {
			const available = session.getAvailableThinkingLevels();
			if (!available.includes(level as (typeof available)[number])) {
				throw new Error(`Unsupported thinking level: ${level}`);
			}
			session.setThinkingLevel(
				level as Parameters<typeof session.setThinkingLevel>[0],
			);
		},
	});
};

function skillCommands(resourceLoader: {
	getSkills(): { skills: Array<{ name: string; description: string }> };
}): ComposerCommand[] {
	return resourceLoader.getSkills().skills.map((skill) => ({
		name: `skill:${skill.name}`,
		description: skill.description,
		source: 'skill',
	}));
}

/** Gizmo's own AGENTS.md files, in the order Pi should apply them. */
async function readAgentsFiles(cwd: string) {
	const paths = await existingFiles(resourceRoots(cwd).agentsFiles);
	return Promise.all(
		paths.map(async (path) => ({
			path,
			content: await readFile(path, 'utf8'),
		})),
	);
}
