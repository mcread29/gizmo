import { resolve } from 'node:path';
import type { ExtensionUi, GizmoExtension } from '@gizmo/extension-api';
import { completeText } from '../sessions/model-completion';

/**
 * Builds the UI descriptor for one extension: its views, the status items and
 * commands it lists right now, the settings form it declares, and the values
 * the server has stored for that form.
 */
export async function describeExtension(
	extension: GizmoExtension,
	projectPath: string,
	sessionId: string | undefined,
	settings: Record<string, unknown>,
): Promise<ExtensionUi> {
	const context = {
		workspacePath: projectPath,
		...(sessionId ? { sessionId } : {}),
		settings,
		complete: completeText,
	};
	const [statusItems, commands] = await Promise.all([
		settle(() => extension.statusItems?.(context), extension, 'statusItems'),
		settle(() => extension.commands?.(context), extension, 'commands'),
	]);
	return {
		id: extension.id,
		name: extension.name,
		views: Object.entries(extension.views ?? {}).map(([id, view]) => ({
			id,
			label: view.label,
			...(view.shortLabel ? { shortLabel: view.shortLabel } : {}),
			scope: view.scope ?? 'workspace',
			placement: view.placement ?? 'inspector',
		})),
		statusItems: statusItems ?? [],
		commands: commands ?? [],
		settings: extension.settings ?? [],
		settingsValues: settings,
		toolPresentation: extension.toolPresentation ?? {},
		hasProjectService: extension.createProjectService !== undefined,
	};
}

/** The identity of an open view: one entry per address. */
export function viewKey({
	projectPath,
	extensionId,
	viewId,
	sessionId,
}: {
	projectPath: string;
	extensionId: string;
	viewId: string;
	sessionId?: string;
}): string {
	return [projectPath, extensionId, viewId, sessionId ?? ''].join('\0');
}

/** A workspace extension is only offered to the workspace it was found in. */
export function inWorkspace(extension: GizmoExtension, path: string): boolean {
	return (
		!extension.workspaceRoot ||
		resolve(extension.workspaceRoot) === resolve(path)
	);
}

async function settle<T>(
	run: () => T | Promise<T> | undefined,
	extension: GizmoExtension,
	what: string,
): Promise<T | undefined> {
	try {
		return await run();
	} catch (error) {
		console.warn(`Extension ${extension.id} failed to list ${what}:`, error);
		return undefined;
	}
}
