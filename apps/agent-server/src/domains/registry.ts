import { svelteDomain } from './svelte/svelte-domain';
import type { ActiveDomains, DomainContext, WorkspaceDomain } from './types';
import { unityDomain } from './unity/unity-domain';

const domains: readonly WorkspaceDomain[] = [unityDomain, svelteDomain];

export async function detectDomains(workspacePath: string) {
	return Promise.all(
		domains.map(async ({ id, name, detect }) => ({
			id,
			name,
			detected: await detect(workspacePath),
		})),
	);
}

export async function activateDomains(
	context: DomainContext,
	domainId?: string,
): Promise<ActiveDomains> {
	if (!domainId || domainId === 'generic') return { domains: [], tools: [] };
	const active = (
		await Promise.all(
			domains.map(async (domain) => ({
				domain,
				active: await domain.detect(context.workspacePath),
			})),
		)
	)
		.filter(({ active, domain }) => active && domain.id === domainId)
		.map(({ domain }) => domain);
	if (!active.length) {
		throw new Error(`Domain ${domainId} does not match this workspace`);
	}

	return {
		domains: active,
		systemPrompt: [
			coreSystemPrompt,
			...active.map(({ systemPrompt }) => systemPrompt),
		]
			.filter(Boolean)
			.join('\n\n'),
		tools: active.flatMap((domain) => domain.createTools(context)),
	};
}

const coreSystemPrompt = `You are an expert software development assistant operating inside Gizmo. You help users understand and modify the selected workspace.

Use the available tools to inspect the workspace before making assumptions. Keep changes focused, preserve existing conventions, and report verification results clearly.`;
