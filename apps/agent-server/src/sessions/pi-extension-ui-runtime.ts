import { randomUUID } from 'node:crypto';
import type {
	ExtensionUIContext,
	ExtensionUIDialogOptions,
	Theme,
} from '@earendil-works/pi-coding-agent';
import type { ExtensionUiRequest, ExtensionUiResponse } from '@gizmo/protocol';

type CancellationReason = 'timeout' | 'signal' | 'runtime' | 'abort';

type RuntimeEvent =
	| {
			type: 'extension.ui.requested';
			runtimeId: string;
			uiRequestId: string;
			request: ExtensionUiRequest;
	  }
	| {
			type: 'extension.ui.cancelled';
			runtimeId: string;
			uiRequestId: string;
			reason: CancellationReason;
	  }
	| {
			type: 'extension.ui.runtime.cleared';
			runtimeId: string;
	  };

interface PendingDialog {
	request: Extract<
		ExtensionUiRequest,
		{ method: 'select' | 'confirm' | 'input' | 'editor' }
	>;
	resolve(value: string | boolean | undefined): void;
	timeout?: ReturnType<typeof setTimeout>;
	signal?: AbortSignal;
	onAbort?: () => void;
}

const passthroughTheme = new Proxy({} as Theme, {
	get(_target, property) {
		if (property === 'name') return 'gizmo';
		if (property === 'getColorMode') return () => 'truecolor';
		return (...args: unknown[]) => lastString(args);
	},
});

/** Browser-backed implementation of Pi's semantic extension UI contract. */
export class PiExtensionUiRuntime {
	#runtimeId = randomUUID();
	#requestCount = 0;
	readonly #pending = new Map<string, PendingDialog>();

	constructor(private readonly emit: (event: RuntimeEvent) => void) {}

	get runtimeId() {
		return this.#runtimeId;
	}

	readonly context: ExtensionUIContext = {
		select: (title, options, opts) =>
			this.#dialog(
				{ method: 'select', title, options, ...timeout(opts) },
				opts,
			).then(stringResult),
		confirm: async (title, message, opts) =>
			(await this.#dialog(
				{ method: 'confirm', title, message, ...timeout(opts) },
				opts,
			)) === true,
		input: (title, placeholder, opts) =>
			this.#dialog(
				{
					method: 'input',
					title,
					...(placeholder === undefined ? {} : { placeholder }),
					...timeout(opts),
				},
				opts,
			).then(stringResult),
		editor: (title, prefill) =>
			this.#dialog({
				method: 'editor',
				title,
				...(prefill === undefined ? {} : { prefill }),
			}).then(stringResult),
		notify: (message, notificationType = 'info') =>
			this.#fire({ method: 'notify', message, notificationType }),
		onTerminalInput: () => () => {},
		setStatus: (key, text) =>
			this.#fire({ method: 'setStatus', key, text: text ?? null }),
		setWorkingMessage: (message) =>
			this.#fire({ method: 'setWorkingMessage', message: message ?? null }),
		setWorkingVisible: (visible) =>
			this.#fire({ method: 'setWorkingVisible', visible }),
		setWorkingIndicator: (options) =>
			this.#fire({
				method: 'setWorkingIndicator',
				frames: options ? (options.frames?.map(stripAnsi) ?? []) : null,
				...(options?.intervalMs === undefined
					? {}
					: { intervalMs: options.intervalMs }),
			}),
		setHiddenThinkingLabel: () => {},
		setWidget: (key, content, options) => {
			if (content !== undefined && !Array.isArray(content)) return;
			this.#fire({
				method: 'setWidget',
				key,
				lines: content ?? null,
				placement: options?.placement ?? 'aboveEditor',
			});
		},
		setFooter: () => {},
		setHeader: () => {},
		setTitle: (title) => this.#fire({ method: 'setTitle', title }),
		custom: async <T>() => undefined as T,
		pasteToEditor: (text) => this.#fire({ method: 'setEditorText', text }),
		setEditorText: (text) => this.#fire({ method: 'setEditorText', text }),
		getEditorText: () => '',
		addAutocompleteProvider: () => {},
		setEditorComponent: () => {},
		getEditorComponent: () => undefined,
		theme: passthroughTheme,
		getAllThemes: () => [],
		getTheme: () => undefined,
		setTheme: () => ({
			success: false,
			error: 'Pi terminal themes are not available in the browser yet',
		}),
		getToolsExpanded: () => false,
		setToolsExpanded: () => {},
	};

	resolve(
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		if (runtimeId !== this.#runtimeId)
			throw new Error('Stale extension UI runtime');
		const pending = this.#pending.get(uiRequestId);
		if (!pending) throw new Error('Unknown extension UI request');

		if (pending.request.method === 'confirm') {
			if (response.kind === 'value') {
				throw new Error('Confirmation requires a confirmed response');
			}
			this.#finish(
				uiRequestId,
				response.kind === 'confirmed' ? response.confirmed : false,
			);
			return;
		}

		if (response.kind === 'confirmed') {
			throw new Error('Text and selection dialogs require a value response');
		}
		if (
			response.kind === 'value' &&
			pending.request.method === 'select' &&
			!pending.request.options.includes(response.value)
		) {
			throw new Error('Selection is not one of the offered options');
		}
		this.#finish(
			uiRequestId,
			response.kind === 'value' ? response.value : undefined,
		);
	}

	cancelDialogs(reason: CancellationReason = 'runtime') {
		for (const requestId of [...this.#pending.keys()]) {
			this.#cancel(requestId, reason);
		}
	}

	startNewRuntime() {
		this.#runtimeId = randomUUID();
		this.#requestCount = 0;
	}

	clear() {
		const runtimeId = this.#runtimeId;
		this.cancelDialogs();
		this.emit({ type: 'extension.ui.runtime.cleared', runtimeId });
	}

	#dialog(request: PendingDialog['request'], opts?: ExtensionUIDialogOptions) {
		if (opts?.signal?.aborted) {
			return Promise.resolve(request.method === 'confirm' ? false : undefined);
		}
		const uiRequestId = `extension-ui-${++this.#requestCount}`;
		return new Promise<string | boolean | undefined>((resolve) => {
			const pending: PendingDialog = { request, resolve };
			if (opts?.timeout) {
				pending.timeout = setTimeout(
					() => this.#cancel(uiRequestId, 'timeout'),
					opts.timeout,
				);
				pending.timeout.unref?.();
			}
			if (opts?.signal) {
				pending.signal = opts.signal;
				pending.onAbort = () => this.#cancel(uiRequestId, 'signal');
				opts.signal.addEventListener('abort', pending.onAbort, { once: true });
			}
			this.#pending.set(uiRequestId, pending);
			this.emit({
				type: 'extension.ui.requested',
				runtimeId: this.#runtimeId,
				uiRequestId,
				request,
			});
		});
	}

	#fire(request: ExtensionUiRequest) {
		this.emit({
			type: 'extension.ui.requested',
			runtimeId: this.#runtimeId,
			uiRequestId: `extension-ui-${++this.#requestCount}`,
			request,
		});
	}

	#cancel(uiRequestId: string, reason: CancellationReason) {
		if (!this.#pending.has(uiRequestId)) return;
		this.emit({
			type: 'extension.ui.cancelled',
			runtimeId: this.#runtimeId,
			uiRequestId,
			reason,
		});
		this.#finish(uiRequestId, undefined);
	}

	#finish(uiRequestId: string, value: string | boolean | undefined) {
		const pending = this.#pending.get(uiRequestId);
		if (!pending) return;
		this.#pending.delete(uiRequestId);
		if (pending.timeout) clearTimeout(pending.timeout);
		if (pending.signal && pending.onAbort) {
			pending.signal.removeEventListener('abort', pending.onAbort);
		}
		pending.resolve(
			pending.request.method === 'confirm' ? value === true : value,
		);
	}
}

function stripAnsi(value: string) {
	return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function stringResult(value: string | boolean | undefined) {
	return typeof value === 'string' ? value : undefined;
}

function lastString(values: unknown[]) {
	for (let index = values.length - 1; index >= 0; index--) {
		if (typeof values[index] === 'string') return values[index];
	}
	return '';
}

function timeout(opts?: ExtensionUIDialogOptions) {
	return opts?.timeout === undefined ? {} : { timeout: opts.timeout };
}
