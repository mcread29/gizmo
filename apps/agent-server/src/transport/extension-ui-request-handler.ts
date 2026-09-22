import type { AgentRequest } from '@gizmo/protocol';
import type { ExtensionUiService } from '../extensions/extension-ui-service';
import type { RouteResult } from './request-router';

type ExtensionUiRequest = Extract<
	AgentRequest,
	{
		type:
			| 'extensions.ui'
			| 'extension.view.open'
			| 'extension.view.close'
			| 'extension.view.action'
			| 'extension.command.run'
			| 'extension.settings.get'
			| 'extension.settings.set';
	}
>;

/**
 * `owner` identifies the connection a view is opened for, so the view closes
 * when that socket drops even if the client never sent `extension.view.close`.
 */
export async function handleExtensionUiRequest(
	ui: ExtensionUiService,
	owner: object,
	request: ExtensionUiRequest,
): Promise<RouteResult> {
	switch (request.type) {
		case 'extensions.ui':
			return {
				result: {
					extensions: await ui.list(request.projectPath, request.sessionId),
				},
			};
		case 'extension.view.open': {
			const view = await ui.open(owner, address(request));
			return { result: view ? { view } : {} };
		}
		case 'extension.view.close':
			ui.close(owner, address(request));
			return { result: {} };
		case 'extension.view.action':
			return { result: await ui.action(address(request), request.event) };
		case 'extension.command.run':
			await ui.runCommand(
				request.projectPath,
				request.extensionId,
				request.commandId,
				request.sessionId,
			);
			return { result: {} };
		case 'extension.settings.get':
			return { result: { values: await ui.settings(request.extensionId) } };
		case 'extension.settings.set':
			return {
				result: {
					values: await ui.setSettings(request.extensionId, request.values),
				},
			};
	}
}

function address(request: {
	projectPath: string;
	extensionId: string;
	viewId: string;
	sessionId?: string;
}) {
	const { projectPath, extensionId, viewId, sessionId } = request;
	return {
		projectPath,
		extensionId,
		viewId,
		...(sessionId ? { sessionId } : {}),
	};
}
