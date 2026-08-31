import { parseFileRevertResult } from '@gizmo/protocol';
import { ResourceRequests } from './resource-requests';

export class GitRequests extends ResourceRequests {
	async revertFile(projectPath: string, file: string, patch: string) {
		const response = await this.request({
			type: 'file.revert',
			projectPath,
			file,
			patch,
		});
		return parseFileRevertResult(response.result);
	}

	async generateCommitMessage(sessionId: string, projectPath: string) {
		const response = await this.request({
			type: 'git.commit-message',
			sessionId,
			projectPath,
		});
		if (typeof response.result !== 'string' || !response.result.trim()) {
			throw new Error('Agent server returned an invalid commit message');
		}
		return response.result;
	}
}
