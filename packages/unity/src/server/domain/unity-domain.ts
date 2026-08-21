import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createUnityTools } from '@gizmo/unity-tools';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { unitySystemPrompt } from './unity-system-prompt';

export const unityDomain: Pick<
	GizmoServerExtension,
	'id' | 'name' | 'detect' | 'profile' | 'systemPrompt' | 'createTools'
> = {
	id: 'unity',
	name: 'Unity',
	detect: (workspacePath) => exists(join(workspacePath, 'ProjectSettings')),
	profile: (root) => ({
		id: 'unity',
		name: 'Unity',
		source: 'extension:unity',
		base: 'default',
		extensions: [{ id: 'unity', root }],
		tools: { mode: 'default-plus-extension' },
		prompt: { mode: 'default-plus-extension-fragments' },
	}),
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
