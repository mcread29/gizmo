import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createUnityTools } from '@unity-agent/unity-tools';
import type { WorkspaceDomain } from '../types';
import { unitySystemPrompt } from './unity-system-prompt';

export const unityDomain: WorkspaceDomain = {
	id: 'unity',
	name: 'Unity',
	detect: (workspacePath) => exists(join(workspacePath, 'ProjectSettings')),
	systemPrompt: unitySystemPrompt,
	createTools: ({ workspacePath, confirm }) =>
		createUnityTools({
			projectPath: workspacePath,
			confirmStopPlayMode: () => confirm('stop_play_mode_for_compile'),
		}),
};

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
