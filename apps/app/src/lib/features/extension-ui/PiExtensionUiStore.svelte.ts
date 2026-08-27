import {
	parseAgentEvent,
	type AgentEvent,
	type ExtensionUiResponse,
} from '@gizmo/protocol';
import type { ToastQueue } from '@gizmo/ui';
import type { AgentClient } from '../../agent-client';

type RequestedEvent = Extract<AgentEvent, { type: 'extension.ui.requested' }>;
export type PiExtensionDialog = RequestedEvent & {
	request: Extract<
		RequestedEvent['request'],
		{ method: 'select' | 'confirm' | 'input' | 'editor' }
	>;
};
export type PiExtensionWidget = RequestedEvent & {
	request: Extract<RequestedEvent['request'], { method: 'setWidget' }>;
};
export type PiExtensionStatus = RequestedEvent & {
	request: Extract<RequestedEvent['request'], { method: 'setStatus' }>;
};
export type PiExtensionEditorCommand = RequestedEvent & {
	request: Extract<RequestedEvent['request'], { method: 'setEditorText' }>;
};

const dialogMethods = new Set(['select', 'confirm', 'input', 'editor']);

export class PiExtensionUiStore {
	dialogs = $state.raw<PiExtensionDialog[]>([]);
	widgets = $state.raw<PiExtensionWidget[]>([]);
	statuses = $state.raw<PiExtensionStatus[]>([]);
	editorCommands = $state.raw<PiExtensionEditorCommand[]>([]);
	titles = $state.raw<RequestedEvent[]>([]);
	working = $state.raw<RequestedEvent[]>([]);
	responding = $state.raw<ReadonlySet<string>>(new Set());
	#unsubscribe?: () => void;
	#unsubscribeDisconnect?: () => void;

	constructor(
		private readonly client: AgentClient,
		private readonly toasts: ToastQueue,
	) {}

	start() {
		this.#unsubscribe ??= this.client.subscribe((event) =>
			this.#receive(event),
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
	#queuedCustomAnswer?: { sessionId: string; text: string };

	queueCustomAnswer(sessionId: string, text: string) {
		this.#queuedCustomAnswer = { sessionId, text };
	}

	dialogFor(sessionId: string | undefined) {
		// Select and input render inline in the chat as agent questions; only
		// confirmations and editors stay modal.
		const candidates = (
			sessionId
				? this.dialogs.filter((dialog) => dialog.sessionId === sessionId)
				: this.dialogs
		).filter(
			(dialog) =>
				dialog.request.method === 'confirm' ||
				dialog.request.method === 'editor',
		);
		return candidates[0];
	}

	/** Pending select/input requests for a session, rendered in the chat. */
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
		const latest = (method: RequestedEvent['request']['method']) => {
			for (let index = events.length - 1; index >= 0; index--) {
				if (events[index]?.request.method === method) return events[index];
			}
			return undefined;
		};
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
		for (let index = this.titles.length - 1; index >= 0; index--) {
			const event = this.titles[index];
			if (
				event?.sessionId === sessionId &&
				event.request.method === 'setTitle'
			) {
				return event.request.title;
			}
		}
		return undefined;
	}

	editorCommandFor(sessionId: string | undefined) {
		return this.editorCommands.find(
			(command) => command.sessionId === sessionId,
		);
	}

	consumeEditorCommand(command: PiExtensionEditorCommand) {
		this.editorCommands = this.editorCommands.filter(
			(candidate) => candidate.uiRequestId !== command.uiRequestId,
		);
	}

	async respond(dialog: PiExtensionDialog, response: ExtensionUiResponse) {
		if (this.responding.has(dialog.uiRequestId)) return;
		this.responding = new Set([...this.responding, dialog.uiRequestId]);
		try {
			await this.client.resolveExtensionUi(
				dialog.sessionId,
				dialog.runtimeId,
				dialog.uiRequestId,
				response,
			);
			this.#removeDialog(dialog.uiRequestId);
		} catch (error) {
			this.toasts.show(
				error instanceof Error
					? `Could not answer extension: ${error.message}`
					: 'Could not answer extension',
				'danger',
			);
			throw error;
		} finally {
			const next = new Set(this.responding);
			next.delete(dialog.uiRequestId);
			this.responding = next;
		}
	}

	clear() {
		this.#queuedCustomAnswer = undefined;
		this.dialogs = [];
		this.widgets = [];
		this.statuses = [];
		this.editorCommands = [];
		this.titles = [];
		this.working = [];
		this.responding = new Set();
	}

	#receive(input: unknown) {
		let event: AgentEvent;
		try {
			event = parseAgentEvent(input);
		} catch {
			return;
		}
		if (event.type === 'extension.ui.cancelled') {
			this.#removeDialog(event.uiRequestId);
			return;
		}
		if (event.type === 'extension.ui.runtime.cleared') {
			this.#clearRuntime(event.sessionId, event.runtimeId);
			return;
		}
		if (event.type !== 'extension.ui.requested') return;

		const method = event.request.method;
		if (dialogMethods.has(method)) {
			// A queued custom answer is delivered silently through the follow-up
			// input request instead of showing the user a second dialog.
			const queued = this.#queuedCustomAnswer;
			if (
				queued &&
				queued.sessionId === event.sessionId &&
				method === 'input'
			) {
				this.#queuedCustomAnswer = undefined;
				const dialog = event as PiExtensionDialog;
				this.respond(dialog, { kind: 'value', value: queued.text }).catch(() =>
					this.dialogs.push(dialog),
				);
				return;
			}
			this.dialogs = [...this.dialogs, event as PiExtensionDialog];
			return;
		}
		if (method === 'notify') {
			this.toasts.show(
				event.request.message,
				event.request.notificationType === 'error'
					? 'danger'
					: event.request.notificationType,
			);
			return;
		}
		if (method === 'setStatus') {
			this.statuses = upsert(this.statuses, event as PiExtensionStatus, 'key');
			return;
		}
		if (
			method === 'setWorkingMessage' ||
			method === 'setWorkingVisible' ||
			method === 'setWorkingIndicator'
		) {
			this.working = [
				...this.working.filter(
					(candidate) =>
						candidate.sessionId !== event.sessionId ||
						candidate.runtimeId !== event.runtimeId ||
						candidate.request.method !== method,
				),
				event,
			];
			return;
		}
		if (method === 'setWidget') {
			this.widgets = upsert(this.widgets, event as PiExtensionWidget, 'key');
			return;
		}
		if (method === 'setTitle') {
			this.titles = [
				...this.titles.filter(
					(candidate) =>
						candidate.sessionId !== event.sessionId ||
						candidate.runtimeId !== event.runtimeId,
				),
				event,
			];
			return;
		}
		if (method === 'setEditorText') {
			this.editorCommands = [
				...this.editorCommands,
				event as PiExtensionEditorCommand,
			];
		}
	}

	#removeDialog(uiRequestId: string) {
		this.dialogs = this.dialogs.filter(
			(dialog) => dialog.uiRequestId !== uiRequestId,
		);
	}

	#clearRuntime(sessionId: string, runtimeId: string) {
		const keep = <T extends { sessionId: string; runtimeId: string }>(
			item: T,
		) => item.sessionId !== sessionId || item.runtimeId !== runtimeId;
		this.dialogs = this.dialogs.filter(keep);
		this.widgets = this.widgets.filter(keep);
		this.statuses = this.statuses.filter(keep);
		this.editorCommands = this.editorCommands.filter(keep);
		this.titles = this.titles.filter(keep);
		this.working = this.working.filter(keep);
	}
}

function upsert<
	T extends {
		sessionId: string;
		runtimeId: string;
		request: { key: string };
	},
>(items: T[], incoming: T, _key: 'key') {
	return [
		...items.filter(
			(item) =>
				item.sessionId !== incoming.sessionId ||
				item.runtimeId !== incoming.runtimeId ||
				item.request.key !== incoming.request.key,
		),
		incoming,
	];
}
