import type { ExtensionUiResponse } from '@gizmo/protocol';
import type { ToastQueue } from '@gizmo/ui';
import type { AgentClient } from '../../agent-client';
import { PiExtensionUiEvents } from './PiExtensionUiEvents';
import { PiExtensionUiState } from './PiExtensionUiState.svelte';
import type {
	PiExtensionDialog,
	PiExtensionEditorCommand,
	PiExtensionStatus,
	PiExtensionUiRequestedEvent,
	PiExtensionWidget,
} from './PiExtensionUiTypes';

export type {
	PiExtensionDialog,
	PiExtensionEditorCommand,
	PiExtensionStatus,
	PiExtensionWidget,
} from './PiExtensionUiTypes';

/**
 * Stable reactive facade for Pi extension UI state and transport behavior.
 * Event routing and state transitions live in focused collaborators so this
 * class remains the single public API consumed by the app.
 */
export class PiExtensionUiStore {
	readonly #state = new PiExtensionUiState();
	readonly #events: PiExtensionUiEvents;
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;

	constructor(
		private readonly client: AgentClient,
		private readonly toasts: ToastQueue,
	) {
		this.#events = new PiExtensionUiEvents(
			this.#state,
			this.toasts,
			(dialog, response) => this.respond(dialog, response),
		);
	}

	get dialogs() {
		return this.#state.dialogs;
	}
	set dialogs(value: PiExtensionDialog[]) {
		this.#state.dialogs = value;
	}

	get widgets() {
		return this.#state.widgets;
	}
	set widgets(value: PiExtensionWidget[]) {
		this.#state.widgets = value;
	}

	get statuses() {
		return this.#state.statuses;
	}
	set statuses(value: PiExtensionStatus[]) {
		this.#state.statuses = value;
	}

	get editorCommands() {
		return this.#state.editorCommands;
	}
	set editorCommands(value: PiExtensionEditorCommand[]) {
		this.#state.editorCommands = value;
	}

	get titles() {
		return this.#state.titles;
	}
	set titles(value: PiExtensionUiRequestedEvent[]) {
		this.#state.titles = value;
	}

	get working() {
		return this.#state.working;
	}
	set working(value: PiExtensionUiRequestedEvent[]) {
		this.#state.working = value;
	}

	get responding() {
		return this.#state.responding;
	}
	set responding(value: ReadonlySet<string>) {
		this.#state.responding = value;
	}

	start() {
		this.#unsubscribe ??= this.client.subscribe((event) =>
			this.#events.receive(event),
		);
		this.#unsubscribeDisconnect ??= this.client.subscribeDisconnect(() =>
			this.clear(),
		);
	}

	dispose() {
		this.#unsubscribe?.();
		this.#unsubscribeDisconnect?.();
		this.#unsubscribe = undefined;
		this.#unsubscribeDisconnect = undefined;
		this.clear();
	}

	/**
	 * Free text typed for a select request. Select responses must be one of
	 * the offered options, so the card submits the (hidden) custom-answer
	 * option and the follow-up input request is answered automatically with
	 * the stashed text — one seamless step for the user.
	 */
	queueCustomAnswer(sessionId: string, text: string) {
		this.#events.queueCustomAnswer(sessionId, text);
	}

	dialogFor(sessionId: string | undefined) {
		return this.#state.dialogFor(sessionId);
	}

	/** Pending select/input requests for a session, rendered in the chat. */
	questionsFor(sessionId: string | undefined) {
		return this.#state.questionsFor(sessionId);
	}

	widgetsFor(
		sessionId: string | undefined,
		placement: 'aboveEditor' | 'belowEditor',
	) {
		return this.#state.widgetsFor(sessionId, placement);
	}

	statusesFor(sessionId: string | undefined) {
		return this.#state.statusesFor(sessionId);
	}

	workingFor(sessionId: string | undefined) {
		return this.#state.workingFor(sessionId);
	}

	titleFor(sessionId: string | undefined) {
		return this.#state.titleFor(sessionId);
	}

	editorCommandFor(sessionId: string | undefined) {
		return this.#state.editorCommandFor(sessionId);
	}

	consumeEditorCommand(command: PiExtensionEditorCommand) {
		this.#state.consumeEditorCommand(command);
	}

	async respond(dialog: PiExtensionDialog, response: ExtensionUiResponse) {
		if (!this.#state.startResponding(dialog.uiRequestId)) return;
		try {
			await this.client.resolveExtensionUi(
				dialog.sessionId,
				dialog.runtimeId,
				dialog.uiRequestId,
				response,
			);
			this.#state.removeDialog(dialog.uiRequestId);
		} catch (error) {
			this.toasts.show(
				error instanceof Error
					? `Could not answer extension: ${error.message}`
					: 'Could not answer extension',
				'danger',
			);
			throw error;
		} finally {
			this.#state.stopResponding(dialog.uiRequestId);
		}
	}

	clear() {
		this.#events.clear();
		this.#state.clear();
	}
}
