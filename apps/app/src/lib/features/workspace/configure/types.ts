import type { ProjectConfig } from '@gizmo/protocol';

export type ReapplyProjectConfig = (
	work: Promise<ProjectConfig | void>,
) => void;
