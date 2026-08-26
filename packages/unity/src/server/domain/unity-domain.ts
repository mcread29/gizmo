import { createUnityTools } from '@gizmo/unity-tools';
import type { GizmoServerExtension } from '@gizmo/extensions';
import { unitySystemPrompt } from './unity-system-prompt';

export const unityDomain: Pick<
	GizmoServerExtension,
	'id' | 'name' | 'profile' | 'systemPrompt' | 'createTools'
> = {
	id: 'unity',
	name: 'Unity',
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
