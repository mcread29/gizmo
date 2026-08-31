import type { AgentEvent } from '@gizmo/protocol';

export type PiExtensionUiRequestedEvent = Extract<
	AgentEvent,
	{ type: 'extension.ui.requested' }
>;
export type PiExtensionDialog = PiExtensionUiRequestedEvent & {
	request: Extract<
		PiExtensionUiRequestedEvent['request'],
		{ method: 'select' | 'confirm' | 'input' | 'editor' }
	>;
};
export type PiExtensionWidget = PiExtensionUiRequestedEvent & {
	request: Extract<
		PiExtensionUiRequestedEvent['request'],
		{ method: 'setWidget' }
	>;
};
export type PiExtensionStatus = PiExtensionUiRequestedEvent & {
	request: Extract<
		PiExtensionUiRequestedEvent['request'],
		{ method: 'setStatus' }
	>;
};
export type PiExtensionEditorCommand = PiExtensionUiRequestedEvent & {
	request: Extract<
		PiExtensionUiRequestedEvent['request'],
		{ method: 'setEditorText' }
	>;
};

export function isDialogRequest(
	event: PiExtensionUiRequestedEvent,
): event is PiExtensionDialog {
	return (
		event.request.method === 'select' ||
		event.request.method === 'confirm' ||
		event.request.method === 'input' ||
		event.request.method === 'editor'
	);
}
