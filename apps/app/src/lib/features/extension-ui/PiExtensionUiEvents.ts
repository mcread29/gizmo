import { parseAgentEvent, type ExtensionUiResponse } from '@gizmo/protocol';
import type { ToastQueue } from '@gizmo/ui';
import type { PiExtensionUiState } from './PiExtensionUiState.svelte';
import {
	isDialogRequest,
	type PiExtensionDialog,
	type PiExtensionEditorCommand,
	type PiExtensionStatus,
	type PiExtensionWidget,
} from './PiExtensionUiTypes';

type Respond = (
	dialog: PiExtensionDialog,
	response: ExtensionUiResponse,
) => Promise<void>;

export class PiExtensionUiEvents {
	#queuedCustomAnswer?: { sessionId: string; text: string };

	constructor(
		private readonly state: PiExtensionUiState,
		private readonly toasts: ToastQueue,
		private readonly respond: Respond,
	) {}

	queueCustomAnswer(sessionId: string, text: string) {
		this.#queuedCustomAnswer = { sessionId, text };
	}

	clear() {
		this.#queuedCustomAnswer = undefined;
	}

	receive(input: unknown) {
		const event = parseEvent(input);
		if (!event) return;
		if (event.type === 'extension.ui.cancelled') {
			this.state.removeDialog(event.uiRequestId);
			return;
		}
		if (event.type === 'extension.ui.runtime.cleared') {
			this.state.clearRuntime(event.sessionId, event.runtimeId);
			return;
		}
		if (event.type !== 'extension.ui.requested') return;

		if (isDialogRequest(event)) {
			this.receiveDialog(event);
			return;
		}

		switch (event.request.method) {
			case 'notify':
				this.toasts.show(
					event.request.message,
					event.request.notificationType === 'error'
						? 'danger'
						: event.request.notificationType,
				);
				break;
			case 'setStatus':
				this.state.upsertStatus(event as PiExtensionStatus);
				break;
			case 'setWorkingMessage':
			case 'setWorkingVisible':
			case 'setWorkingIndicator':
				this.state.setWorking(event);
				break;
			case 'setWidget':
				this.state.upsertWidget(event as PiExtensionWidget);
				break;
			case 'setTitle':
				this.state.setTitle(event);
				break;
			case 'setEditorText':
				this.state.addEditorCommand(event as PiExtensionEditorCommand);
		}
	}

	private receiveDialog(dialog: PiExtensionDialog) {
		// A queued custom answer is delivered silently through the follow-up
		// input request instead of showing the user a second dialog.
		const queued = this.#queuedCustomAnswer;
		if (
			queued &&
			queued.sessionId === dialog.sessionId &&
			dialog.request.method === 'input'
		) {
			this.#queuedCustomAnswer = undefined;
			this.respond(dialog, { kind: 'value', value: queued.text }).catch(() =>
				this.state.addDialog(dialog),
			);
			return;
		}
		this.state.addDialog(dialog);
	}
}

function parseEvent(input: unknown) {
	try {
		return parseAgentEvent(input);
	} catch {
		return undefined;
	}
}
