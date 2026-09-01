import { parseGitCommitResult, parseGitStatus } from '@gizmo/protocol';
import type { AgentClient } from '../AgentClient';
import type { AgentStore } from '../AgentStore.svelte';

export class GitCapability {
	constructor(
		private readonly store: AgentStore,
		private readonly client: AgentClient,
	) {}

	async revertFile(file: string, patch: string) {
		if (!this.store.selectedProjectPath) {
			throw new Error('No workspace is selected');
		}
		await this.client.revertFile(this.store.selectedProjectPath, file, patch);
	}

	async refreshGitStatus() {
		const store = this.store;
		if (!store.enabledExtensionIds.includes('git')) {
			store.gitStatus = undefined;
			store.gitLoading = false;
			return;
		}
		if (store.connection !== 'connected' || !store.selectedProjectPath) return;
		const projectPath = store.selectedProjectPath;
		store.gitLoading = true;
		try {
			const status = parseGitStatus(
				await store.invokeProjectExtension(projectPath, 'git', 'status'),
			);
			if (store.selectedProjectPath === projectPath) store.gitStatus = status;
		} finally {
			if (store.selectedProjectPath === projectPath) store.gitLoading = false;
		}
	}

	async generateCommitMessage() {
		if (!this.store.sessionId) throw new Error('No active session');
		if (!this.store.selectedProjectPath) throw new Error('No project selected');
		return this.client.generateCommitMessage(
			this.store.sessionId,
			this.store.selectedProjectPath,
		);
	}

	async commitAll(message: string) {
		const projectPath = this.store.selectedProjectPath;
		if (!projectPath) throw new Error('No project selected');
		this.store.gitCommitting = true;
		try {
			const result = parseGitCommitResult(
				await this.store.invokeProjectExtension(projectPath, 'git', 'commit', {
					message,
				}),
			);
			await this.refreshGitStatus();
			return result;
		} finally {
			this.store.gitCommitting = false;
		}
	}
}
