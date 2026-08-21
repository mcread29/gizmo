import type { GizmoServerExtension } from '@gizmo/extensions';

/**
 * Skill-authoring guidance only; the skills/ directory is the payload. This
 * stub exists so the extension can be listed in `gizmo.extensions.json` like
 * every other first-party package.
 */
export const gizmoExtension: GizmoServerExtension = {
	id: 'skill-authoring',
	name: 'Skill Authoring',
};
