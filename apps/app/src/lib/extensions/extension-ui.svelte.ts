import type {
	Command,
	ExtensionUi,
	SettingsField,
	StatusItem,
	ViewSummary,
} from '@gizmo/extension-api';
import type { AgentClient } from '../agent-client/AgentClient';

/** A contribution carries the extension that made it; ids are only unique there. */
export interface Contribution<T> {
	extensionId: string;
	extensionName: string;
	value: T;
}

/** What the store needs to know about the workspace, read live. */
export interface ExtensionUiSource {
	readonly selectedProjectPath: string | undefined;
	readonly sessionId: string | undefined;
}

function contributions<T>(
	extensions: readonly ExtensionUi[],
	pick: (extension: ExtensionUi) => readonly T[],
): Contribution<T>[] {
	return extensions.flatMap((extension) =>
		pick(extension).map((value) => ({
			extensionId: extension.id,
			extensionName: extension.name,
			value,
		})),
	);
}

/**
 * What the workspace's enabled extensions contribute to the UI, as data.
 * Extensions ship no browser code: this is the whole catalog the host renders
 * from, re-fetched whenever the server says it changed or the workspace does.
 */
export class ExtensionUiStore {
	extensions = $state<ExtensionUi[]>([]);
	loading = $state(false);
	#client?: AgentClient;
	#source?: ExtensionUiSource;
	#stop?: () => void;
	/** Guards against an older fetch landing after a newer one. */
	#generation = 0;

	/**
	 * Follows `source`'s workspace and the server's change events until the
	 * returned function (or the next `attach`) tears it down.
	 */
	attach(client: AgentClient, source: ExtensionUiSource): () => void {
		this.detach();
		this.#client = client;
		this.#source = source;
		const unsubscribe = client.subscribe((event) => this.receive(event));
		const stopEffects = $effect.root(() => {
			$effect(() => {
				// Read reactively: a workspace switch re-fetches the catalog.
				source.selectedProjectPath;
				void this.refresh();
			});
		});
		this.#stop = () => {
			unsubscribe();
			stopEffects();
		};
		return () => this.detach();
	}

	detach(): void {
		this.#stop?.();
		this.#stop = undefined;
		this.#client = undefined;
		this.#source = undefined;
		this.#generation++;
		this.extensions = [];
	}

	/** Re-fetches the catalog for the workspace on screen. */
	async refresh(): Promise<void> {
		const client = this.#client;
		const projectPath = this.#source?.selectedProjectPath;
		const generation = ++this.#generation;
		if (!client || !projectPath) {
			if (!projectPath) this.extensions = [];
			return;
		}
		this.loading = true;
		try {
			const extensions = await client.listExtensionUi(
				projectPath,
				this.#source?.sessionId,
			);
			if (generation === this.#generation) this.extensions = extensions;
		} catch (error) {
			if (generation === this.#generation) this.extensions = [];
			console.warn('Could not load extension UI', error);
		} finally {
			if (generation === this.#generation) this.loading = false;
		}
	}

	/** Events that invalidate the catalog; view updates are not among them. */
	receive(event: unknown): void {
		if (typeof event !== 'object' || event === null || !('type' in event))
			return;
		const message = event as { type: string; projectPath?: string };
		if (message.type === 'extensions.reloaded') {
			void this.refresh();
			return;
		}
		if (message.type !== 'extensions.ui.changed') return;
		// No project path means "every workspace", so it always applies.
		if (
			message.projectPath &&
			message.projectPath !== this.#source?.selectedProjectPath
		)
			return;
		void this.refresh();
	}

	inspectorViews(): Contribution<ViewSummary>[] {
		return contributions(this.extensions, (extension) =>
			extension.views.filter((view) => view.placement === 'inspector'),
		);
	}

	modalViews(): Contribution<ViewSummary>[] {
		return contributions(this.extensions, (extension) =>
			extension.views.filter((view) => view.placement === 'modal'),
		);
	}

	viewSummary(
		extensionId: string,
		viewId: string,
	): Contribution<ViewSummary> | undefined {
		const extension = this.extensions.find(({ id }) => id === extensionId);
		const value = extension?.views.find(({ id }) => id === viewId);
		return extension && value
			? { extensionId, extensionName: extension.name, value }
			: undefined;
	}

	statusItems(): Contribution<StatusItem>[] {
		return contributions(this.extensions, (extension) => extension.statusItems);
	}

	commands(): Contribution<Command>[] {
		return contributions(this.extensions, (extension) => extension.commands);
	}

	settingsFields(): Contribution<SettingsField[]>[] {
		return this.extensions
			.filter((extension) => extension.settings.length > 0)
			.map((extension) => ({
				extensionId: extension.id,
				extensionName: extension.name,
				value: extension.settings,
			}));
	}

	/** A human label for a tool, or undefined when no extension names it. */
	labelFor(tool: string): string | undefined {
		for (const extension of this.extensions) {
			const label = extension.toolPresentation.labels?.[tool];
			if (label) return label;
		}
	}

	/** A lucide icon name the host knows, e.g. `plug-zap`. */
	iconFor(tool: string): string | undefined {
		for (const extension of this.extensions) {
			const icon = extension.toolPresentation.icons?.[tool];
			if (icon) return icon;
		}
	}

	/** The parameter names worth showing on a tool's card, if any are named. */
	parametersFor(tool: string): string[] | undefined {
		for (const extension of this.extensions) {
			const names = extension.toolPresentation.parameters?.[tool];
			if (names) return names;
		}
	}

	hasProjectService(extensionId: string): boolean {
		return this.extensions.some(
			(extension) =>
				extension.id === extensionId && extension.hasProjectService,
		);
	}
}

/**
 * One catalog per app: tool labels and project-service lookups are read from
 * module scope, where there is no component to hold a store.
 */
export const extensionUi = new ExtensionUiStore();
