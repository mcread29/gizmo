import { resolve } from 'node:path';
import {
	parseView,
	viewIssues,
	type ActionEvent,
	type ActionResult,
	type ExtensionUi,
	type GizmoExtension,
	type View,
	type ViewHandle,
} from '@gizmo/extension-api';

export interface ViewAddress {
	projectPath: string;
	extensionId: string;
	viewId: string;
	sessionId?: string;
}

export interface ExtensionUiEmitters {
	viewUpdated(address: ViewAddress, view: View): void;
}

interface OpenView {
	address: ViewAddress;
	handle: Promise<ViewHandle>;
	latest?: View;
	/** Connections that opened it; the view closes when the last one leaves. */
	owners: Set<object>;
	closed: boolean;
}

/**
 * Serves extension UI as data. The catalog lists what every enabled extension
 * contributes; views are opened per connection, shared across connections
 * that open the same one, and stream `update`s to every client until the
 * last one closes it or its socket drops.
 */
export class ExtensionUiService {
	readonly #extensions: () => readonly GizmoExtension[];
	readonly #views = new Map<string, OpenView>();

	constructor(
		extensions: readonly GizmoExtension[] | (() => readonly GizmoExtension[]),
		private readonly emit: ExtensionUiEmitters,
		private readonly enabledFor?: (workspacePath: string) => Promise<string[]>,
	) {
		this.#extensions =
			typeof extensions === 'function' ? extensions : () => extensions;
	}

	async list(projectPath: string, sessionId?: string): Promise<ExtensionUi[]> {
		const enabled = this.enabledFor
			? new Set(await this.enabledFor(projectPath))
			: undefined;
		const context = {
			workspacePath: projectPath,
			...(sessionId ? { sessionId } : {}),
		};
		const result: ExtensionUi[] = [];
		for (const extension of this.#extensions()) {
			if (enabled && !enabled.has(extension.id)) continue;
			if (!inWorkspace(extension, projectPath)) continue;
			const [statusItems, commands] = await Promise.all([
				settle(
					() => extension.statusItems?.(context),
					extension,
					'statusItems',
				),
				settle(() => extension.commands?.(context), extension, 'commands'),
			]);
			result.push({
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
				toolPresentation: extension.toolPresentation ?? {},
				hasProjectService: extension.createProjectService !== undefined,
			});
		}
		return result;
	}

	/** Opens (or joins) a view for `owner` and returns its latest content. */
	async open(
		owner: object,
		address: ViewAddress,
		settings: Record<string, unknown> = {},
	): Promise<View | undefined> {
		address = this.#address(address);
		const key = viewKey(address);
		let open = this.#views.get(key);
		if (!open) {
			const extension = this.#extension(
				address.extensionId,
				address.projectPath,
			);
			const definition = extension.views?.[address.viewId];
			if (!definition)
				throw new Error(
					`Extension ${address.extensionId} has no view: ${address.viewId}`,
				);
			const scope = definition.scope ?? 'workspace';
			if (scope === 'thread' && !address.sessionId)
				throw new Error(`View ${address.viewId} needs a thread`);
			const entry: OpenView = {
				address:
					scope === 'thread' ? address : { ...address, sessionId: undefined },
				handle: undefined as unknown as Promise<ViewHandle>,
				owners: new Set(),
				closed: false,
			};
			entry.handle = Promise.resolve().then(() =>
				definition.open({
					workspacePath: address.projectPath,
					...(scope === 'thread' && address.sessionId
						? { sessionId: address.sessionId }
						: {}),
					settings,
					update: (view) => this.#update(entry, view),
				}),
			);
			entry.handle.catch(() => {
				this.#views.delete(key);
			});
			this.#views.set(key, entry);
			open = entry;
		}
		open.owners.add(owner);
		try {
			await open.handle;
		} catch (error) {
			open.owners.delete(owner);
			throw error;
		}
		return open.latest;
	}

	close(owner: object, address: ViewAddress): void {
		address = this.#address(address);
		const key = viewKey(address);
		const open = this.#views.get(key);
		if (!open) return;
		open.owners.delete(owner);
		if (!open.owners.size) void this.#dispose(key, open);
	}

	/** Closes every view `owner` still holds; called when its socket drops. */
	release(owner: object): void {
		for (const [key, open] of this.#views) {
			if (!open.owners.delete(owner) || open.owners.size) continue;
			void this.#dispose(key, open);
		}
	}

	async action(
		address: ViewAddress,
		event: ActionEvent,
	): Promise<ActionResult> {
		const open = this.#views.get(viewKey(this.#address(address)));
		if (!open) throw new Error(`View is not open: ${address.viewId}`);
		const handle = await open.handle;
		if (!handle.action)
			return { status: 'rejected', message: 'View has no actions' };
		try {
			const result = await handle.action(event);
			return result ?? { status: 'succeeded' };
		} catch (error) {
			return {
				status: 'failed',
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}

	async runCommand(
		projectPath: string,
		extensionId: string,
		commandId: string,
		sessionId?: string,
	): Promise<void> {
		const extension = this.#extension(extensionId, projectPath);
		if (!extension.runCommand)
			throw new Error(`Extension ${extensionId} runs no commands`);
		await extension.runCommand(commandId, {
			workspacePath: projectPath,
			...(sessionId ? { sessionId } : {}),
		});
	}

	/**
	 * Drops every open view. Run on an extension reload: the code that
	 * created the handles is being replaced, and clients reopen after the
	 * `extensions.reloaded` event.
	 */
	async reset(): Promise<void> {
		const entries = [...this.#views];
		this.#views.clear();
		await Promise.all(entries.map(([key, open]) => this.#dispose(key, open)));
	}

	dispose(): void {
		void this.reset();
	}

	#address(address: ViewAddress): ViewAddress {
		const extension = this.#extension(address.extensionId, address.projectPath);
		return extension.views?.[address.viewId]?.scope === 'thread'
			? address
			: { ...address, sessionId: undefined };
	}

	#extension(id: string, projectPath: string): GizmoExtension {
		const extension = this.#extensions().find(
			(entry) => entry.id === id && inWorkspace(entry, projectPath),
		);
		if (!extension) throw new Error(`Extension is not installed: ${id}`);
		return extension;
	}

	#update(entry: OpenView, view: View): void {
		if (entry.closed) return;
		const parsed = parseView(view);
		if (!parsed) {
			console.warn(
				`Extension ${entry.address.extensionId} produced an invalid view ${entry.address.viewId}: ${viewIssues(view).join('; ')}`,
			);
			return;
		}
		entry.latest = parsed;
		this.emit.viewUpdated(entry.address, parsed);
	}

	async #dispose(key: string, open: OpenView): Promise<void> {
		if (this.#views.get(key) === open) this.#views.delete(key);
		open.closed = true;
		try {
			await (await open.handle).dispose();
		} catch (error) {
			console.warn(`View ${open.address.viewId} failed to dispose:`, error);
		}
	}
}

function viewKey({ projectPath, extensionId, viewId, sessionId }: ViewAddress) {
	return [projectPath, extensionId, viewId, sessionId ?? ''].join('\0');
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

function inWorkspace(extension: GizmoExtension, path: string) {
	return (
		!extension.workspaceRoot ||
		resolve(extension.workspaceRoot) === resolve(path)
	);
}
