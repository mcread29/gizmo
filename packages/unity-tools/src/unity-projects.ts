import {
	runUnityJson,
	unityJsonArgs,
	type UnityJsonDetails,
} from './unity-json';
import type { UnityCommandRunner } from './unity-runner';
import { getUnityStatus, type UnityStatusDetails } from './unity-status';

export interface UnityProject {
	title: string;
	path: string;
	version?: string;
	lastModified?: number;
	isFavorite: boolean;
	buildTarget?: string;
	renderPipeline?: string;
}

export interface UnityProjectsDetails extends UnityJsonDetails {
	projects: UnityProject[];
}

export interface UnityOpenProjectDetails extends UnityJsonDetails {
	state: 'opened' | 'already_open' | 'error';
	status?: UnityStatusDetails;
}

export async function listUnityProjects(
	runner: UnityCommandRunner,
	signal?: AbortSignal,
): Promise<UnityProjectsDetails> {
	const result = await runUnityJson(
		runner,
		[...unityJsonArgs, 'projects', 'list', '--all', '--verbose'],
		{ signal },
	);
	return { ...result, projects: normalizeProjects(result.data) };
}

export async function openUnityProject(
	runner: UnityCommandRunner,
	projectPath: string,
	signal?: AbortSignal,
): Promise<UnityOpenProjectDetails> {
	const status = await getUnityStatus(runner, { projectPath, signal });
	if (status.state === 'connected') {
		return {
			state: 'already_open',
			ok: true,
			command: status.command,
			exitCode: status.exitCode,
			durationMs: status.durationMs,
			data: null,
			errors: status.errors,
			warnings: status.warnings,
			status,
		};
	}

	const result = await runUnityJson(
		runner,
		[...unityJsonArgs, 'open', projectPath],
		{ signal, timeoutMs: 120_000 },
	);
	return {
		...result,
		state: result.ok ? 'opened' : 'error',
	};
}

function normalizeProjects(data: unknown): UnityProject[] {
	if (!Array.isArray(data)) return [];
	return data.flatMap((value) => {
		if (!value || typeof value !== 'object') return [];
		const input = value as Record<string, unknown>;
		if (typeof input.title !== 'string' || typeof input.path !== 'string') {
			return [];
		}
		return [
			{
				title: input.title,
				path: input.path,
				...(typeof input.version === 'string'
					? { version: input.version }
					: {}),
				...(typeof input.lastModified === 'number'
					? { lastModified: input.lastModified }
					: {}),
				isFavorite: input.isFavorite === true,
				...(typeof input.buildTarget === 'string'
					? { buildTarget: input.buildTarget }
					: {}),
				...(typeof input.renderPipeline === 'string'
					? { renderPipeline: input.renderPipeline }
					: {}),
			},
		];
	});
}
