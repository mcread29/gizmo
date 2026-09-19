import type { ToolPolicy } from '@gizmo/protocol';
import {
	readToolPolicy,
	writeGlobalToolPolicy,
	writeProjectToolPolicy,
} from '../settings/tool-policy';
import { workspaceTrusted } from '../projects/project-trust';
import { defaultDataDir } from './session-repository';

/** Reads and writes Pi-compatible tool policy for the active runtime mode. */
export class ToolPolicyService {
	async get(workspacePath?: string): Promise<ToolPolicy> {
		const agentDir = await agentDirForToolPolicy();
		const cwd = workspacePath ?? process.cwd();
		return readToolPolicy({
			cwd,
			agentDir,
			...(process.env.GIZMO_PI_WEB === '1'
				? { projectTrusted: await workspaceTrusted(cwd) }
				: {}),
		});
	}

	async setGlobal(tools: string[]) {
		await writeGlobalToolPolicy(await agentDirForToolPolicy(), tools);
		return this.get();
	}

	async setProject(workspacePath: string, tools: string[] | null) {
		const agentDir = await agentDirForToolPolicy();
		await writeProjectToolPolicy(workspacePath, tools);
		return readToolPolicy({
			cwd: workspacePath,
			agentDir,
			...(process.env.GIZMO_PI_WEB === '1'
				? {
						projectTrusted: await workspaceTrusted(workspacePath),
					}
				: {}),
		});
	}
}

async function agentDirForToolPolicy() {
	if (process.env.GIZMO_PI_WEB === '1') {
		const { getAgentDir } = await import('@earendil-works/pi-coding-agent');
		return getAgentDir();
	}
	return defaultDataDir();
}
