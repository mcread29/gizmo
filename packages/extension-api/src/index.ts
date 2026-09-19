/** Version of the extension contract; the package's major tracks it. */
export const extensionApiVersion = 1;

export { defineExtension } from './extension';
export type {
	ActiveExtensions,
	ExtensionContext,
	ExtensionDescriptor,
	ExtensionOperation,
	GizmoExtension,
	GizmoServerExtension,
} from './extension';
export { ProjectServiceRegistry } from './project-service';
export type {
	ProjectService,
	ProjectStatus,
	ProjectWatchListeners,
} from './project-service';
export { PatchMismatchError, parseHunks, revertPatch } from './patch';
export type { DiffHunk } from './patch';
export { gizmoDisplay, gizmoView } from './display';
export * from './display-schema';
export * from './view';
export * from './ui';
export { boundedJson } from './bounded-json';
