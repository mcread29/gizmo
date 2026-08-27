import { createUnityTools } from '@gizmo/unity-tools';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { unitySystemPrompt } from './unity-system-prompt';

export const unityDomain: Pick<
	GizmoServerExtension,
	'id' | 'name' | 'systemPrompt' | 'createTools'
> = {
	id: 'unity',
	name: 'Unity',
	systemPrompt: unitySystemPrompt,
	createTools: ({ workspacePath, confirm }) =>
		createUnityTools({
			projectPath: workspacePath,
			confirmStopPlayMode: () => confirm('stop_play_mode_for_compile'),
		}),
};
