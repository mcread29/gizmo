import type { ToolPolicy } from '@gizmo/protocol';
import {
	readToolPolicy,
	writeGlobalToolPolicy,
	writeProjectToolPolicy,
} from '../settings/tool-policy';
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
				? { projectTrusted: await projectSettingsTrusted(cwd, agentDir) }
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
						projectTrusted: await projectSettingsTrusted(
							workspacePath,
							agentDir,
						),
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

/** Apply workspace settings only when Pi's project-trust rules allow them. */
async function projectSettingsTrusted(cwd: string, agentDir: string) {
	const {
		hasTrustRequiringProjectResources,
		ProjectTrustStore,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	if (!hasTrustRequiringProjectResources(cwd)) return true;
	const saved = new ProjectTrustStore(agentDir).get(cwd);
	if (saved !== null) return saved;
	return (
		SettingsManager.create(cwd, agentDir).getDefaultProjectTrust() === 'always'
	);
}
