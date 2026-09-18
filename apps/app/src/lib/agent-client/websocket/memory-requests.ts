import {
	parseDigestSettings,
	parseJournalDigests,
	parseMemoryStatus,
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

	async setMemorySettings(settings: DigestSettings) {
		const response = await this.request({
			type: 'memory.settings.set',
			settings,
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
