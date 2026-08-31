import {
	addToReadonlySet,
	emptyReadonlySet,
	findLatest,
	removeFromReadonlySet,
	upsertByKey,
} from './PiExtensionUiCollections';
import type {
	PiExtensionDialog,
	PiExtensionEditorCommand,
	PiExtensionStatus,
	PiExtensionUiRequestedEvent,
	PiExtensionWidget,
} from './PiExtensionUiTypes';

type RuntimeEvent = { sessionId: string; runtimeId: string };
type WorkingMethod = PiExtensionUiRequestedEvent['request']['method'];

export class PiExtensionUiState {
	dialogs = $state.raw<PiExtensionDialog[]>([]);
	widgets = $state.raw<PiExtensionWidget[]>([]);
	statuses = $state.raw<PiExtensionStatus[]>([]);
	editorCommands = $state.raw<PiExtensionEditorCommand[]>([]);
	titles = $state.raw<PiExtensionUiRequestedEvent[]>([]);
	working = $state.raw<PiExtensionUiRequestedEvent[]>([]);
	responding = $state.raw<ReadonlySet<string>>(emptyReadonlySet());

	dialogFor(sessionId: string | undefined) {
		// Select and input render inline in the chat as agent questions; only
		// confirmations and editors stay modal.
		return this.dialogs.find(
			(dialog) =>
				(!sessionId || dialog.sessionId === sessionId) &&
				(dialog.request.method === 'confirm' ||
					dialog.request.method === 'editor'),
		);
	}

	questionsFor(sessionId: string | undefined) {
		if (!sessionId) return [];
		return this.dialogs.filter(
			(dialog) =>
				dialog.sessionId === sessionId &&
				(dialog.request.method === 'select' ||
					dialog.request.method === 'input'),
		);
	}

	widgetsFor(
		sessionId: string | undefined,
		placement: 'aboveEditor' | 'belowEditor',
	) {
		return this.widgets.filter(
			(widget) =>
				widget.sessionId === sessionId &&
				widget.request.placement === placement &&
				widget.request.lines !== null,
		);
	}

	statusesFor(sessionId: string | undefined) {
		return this.statuses.filter(
			(status) =>
				status.sessionId === sessionId && status.request.text !== null,
		);
	}

	workingFor(sessionId: string | undefined) {
		const events = this.working.filter(
			(event) => event.sessionId === sessionId,
		);
		const latest = (method: WorkingMethod) =>
			findLatest(events, (event) => event.request.method === method);
		const message = latest('setWorkingMessage')?.request;
		const visibility = latest('setWorkingVisible')?.request;
		const indicator = latest('setWorkingIndicator')?.request;
		return {
			message:
				message?.method === 'setWorkingMessage' ? message.message : undefined,
			visible:
				visibility?.method === 'setWorkingVisible'
					? visibility.visible
					: undefined,
			frames:
				indicator?.method === 'setWorkingIndicator'
					? indicator.frames
					: undefined,
			intervalMs:
				indicator?.method === 'setWorkingIndicator'
					? indicator.intervalMs
					: undefined,
		};
	}

	titleFor(sessionId: string | undefined) {
		const event = findLatest(
			this.titles,
			(candidate) =>
				candidate.sessionId === sessionId &&
				candidate.request.method === 'setTitle',
		);
		return event?.request.method === 'setTitle'
			? event.request.title
			: undefined;
	}

	editorCommandFor(sessionId: string | undefined) {
		return this.editorCommands.find(
			(command) => command.sessionId === sessionId,
		);
	}

	addDialog(dialog: PiExtensionDialog) {
		this.dialogs = [...this.dialogs, dialog];
	}

	removeDialog(uiRequestId: string) {
		this.dialogs = this.dialogs.filter(
			(dialog) => dialog.uiRequestId !== uiRequestId,
		);
	}

	consumeEditorCommand(command: PiExtensionEditorCommand) {
		this.editorCommands = this.editorCommands.filter(
			(candidate) => candidate.uiRequestId !== command.uiRequestId,
		);
	}

	upsertStatus(status: PiExtensionStatus) {
		this.statuses = upsertByKey(this.statuses, status);
	}

	upsertWidget(widget: PiExtensionWidget) {
		this.widgets = upsertByKey(this.widgets, widget);
	}

	setWorking(event: PiExtensionUiRequestedEvent) {
		this.working = [
			...this.working.filter(
				(candidate) =>
					candidate.sessionId !== event.sessionId ||
					candidate.runtimeId !== event.runtimeId ||
					candidate.request.method !== event.request.method,
			),
			event,
		];
	}

	setTitle(event: PiExtensionUiRequestedEvent) {
		this.titles = [
			...this.titles.filter(
				(candidate) =>
					candidate.sessionId !== event.sessionId ||
					candidate.runtimeId !== event.runtimeId,
			),
			event,
		];
	}

	addEditorCommand(command: PiExtensionEditorCommand) {
		this.editorCommands = [...this.editorCommands, command];
	}

	startResponding(uiRequestId: string) {
		if (this.responding.has(uiRequestId)) return false;
		this.responding = addToReadonlySet(this.responding, uiRequestId);
		return true;
	}

	stopResponding(uiRequestId: string) {
		this.responding = removeFromReadonlySet(this.responding, uiRequestId);
	}

	clear() {
		this.dialogs = [];
		this.widgets = [];
		this.statuses = [];
		this.editorCommands = [];
		this.titles = [];
		this.working = [];
		this.responding = emptyReadonlySet();
	}

	clearRuntime(sessionId: string, runtimeId: string) {
		const keep = (item: RuntimeEvent) =>
			item.sessionId !== sessionId || item.runtimeId !== runtimeId;
		this.dialogs = this.dialogs.filter(keep);
		this.widgets = this.widgets.filter(keep);
		this.statuses = this.statuses.filter(keep);
		this.editorCommands = this.editorCommands.filter(keep);
		this.titles = this.titles.filter(keep);
		this.working = this.working.filter(keep);
	}
}
