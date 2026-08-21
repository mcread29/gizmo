import { svelteDomain } from './svelte/svelte-domain';
import { relative, resolve } from 'node:path';
import type {
	WorkspaceIntegration,
	WorkspaceProfile,
} from '@unity-agent/protocol';
import type {
	ActiveDomains,
	DomainContext,
	WorkspaceDomain,
} from '@unity-agent/domains';
import { unityDomain } from '@unity-agent/unity/server';

const domains: readonly WorkspaceDomain[] = [unityDomain, svelteDomain];

export async function detectDomains(workspacePath: string) {
	const detected = await Promise.all(
		domains.map(async (domain) => {
			const roots = domain.detectRoots
				? await domain.detectRoots(workspacePath)
				: (await domain.detect(workspacePath))
					? [workspacePath]
					: [];
			const root = roots[0];
			return {
				id: domain.id,
				name: domain.name,
				detected: Boolean(root),
				root: root ? relative(workspacePath, root) || '.' : '.',
			};
		}),
	);
	return {
		domains: detected,
		profiles: [
			defaultProfile(),
			...detected
				.filter(({ detected }) => detected)
				.map(({ id, root }) => domainFor(id).profile(root)),
		],
	};
}

export async function activateDomains(
	context: DomainContext,
	integrations: readonly WorkspaceIntegration[] = [],
): Promise<ActiveDomains> {
	if (!integrations.length) return { domains: [], tools: [] };
	const active = integrations.map((integration) => {
		const domain = domains.find(({ id }) => id === integration.id);
		if (!domain) throw new Error(`Unknown integration: ${integration.id}`);
		const workspacePath = resolve(context.workspacePath);
		const integrationPath = resolve(workspacePath, integration.root);
		if (
			integrationPath !== workspacePath &&
			!integrationPath.startsWith(`${workspacePath}/`)
		) {
			throw new Error(
				`Integration root must be inside the workspace: ${integration.root}`,
			);
		}
		return { domain, integrationPath };
	});

	return {
		domains: active.map(({ domain }) => domain),
		systemPrompt: [
			coreSystemPrompt,
			...active.map(
				({ domain, integrationPath }) =>
					`${domain.systemPrompt}\nIntegration root: ${integrationPath}`,
			),
		]
			.filter(Boolean)
			.join('\n\n'),
		tools: active.flatMap(({ domain, integrationPath }) =>
			domain.createTools({ ...context, workspacePath: integrationPath }),
		),
	};
}

const coreSystemPrompt = `You are an expert software development assistant operating inside Gizmo. You help users understand and modify the selected workspace.

Use the available tools to inspect the workspace before making assumptions. Keep changes focused, preserve existing conventions, and report verification results clearly.`;

export function defaultProfile(): WorkspaceProfile {
	return {
		id: 'default',
		name: 'Default',
		source: 'builtin:default',
		base: null,
		extensions: [],
		tools: { mode: 'default' },
		prompt: { mode: 'pi-default' },
	};
}

function domainFor(id: string): WorkspaceDomain {
	const domain = domains.find((candidate) => candidate.id === id);
	if (!domain) throw new Error(`Unknown extension: ${id}`);
	return domain;
}
