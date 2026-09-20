import {
	parseDigestScope,
	parseDigestSettings,
	parseJournalDigests,
	parseJournalFacts,
	parseMemoryStatus,
	type DigestOverride,
	type DigestSettings,
} from '@gizmo/protocol';
import { GitRequests } from './git-requests';

export class MemoryRequests extends GitRequests {
	async memoryStatus(projectPath: string) {
		const response = await this.request({ type: 'memory.status', projectPath });
		return parseMemoryStatus(response.result);
	}

	async memoryDigests(projectPath: string, query?: string, limit?: number) {
		const response = await this.request({
			type: 'memory.digests',
			projectPath,
			...(query ? { query } : {}),
			...(limit ? { limit } : {}),
		});
		return parseJournalDigests(response.result);
	}

	async memoryFacts(projectPath: string) {
		const response = await this.request({ type: 'memory.facts', projectPath });
		return parseJournalFacts(response.result);
	}

	/** No project reads the default itself; a project reads its view of it. */
	async memorySettings(projectPath?: string) {
		const response = await this.request({
			type: 'memory.settings',
			...(projectPath ? { projectPath } : {}),
		});
		return parseDigestScope(response.result);
	}

	async setMemoryDefaults(settings: DigestSettings) {
		const response = await this.request({
			type: 'memory.settings.set',
			settings,
		});
		return parseDigestSettings(response.result);
	}

	/** Writes one workspace's override, or clears it so it inherits again. */
	async setMemoryOverride(projectPath: string, override?: DigestOverride) {
		const response = await this.request({
			type: 'memory.settings.set',
			projectPath,
			...(override ? { override } : { inherit: true }),
		});
		return parseDigestSettings(response.result);
	}

	async startMemoryBackfill(projectPath: string, regenerate?: boolean) {
		const response = await this.request({
			type: 'memory.backfill.start',
			projectPath,
			...(regenerate ? { regenerate } : {}),
		});
		return parseMemoryStatus(response.result);
	}

	async stopMemoryBackfill(projectPath: string) {
		const response = await this.request({
			type: 'memory.backfill.stop',
			projectPath,
		});
		return parseMemoryStatus(response.result);
	}
}
