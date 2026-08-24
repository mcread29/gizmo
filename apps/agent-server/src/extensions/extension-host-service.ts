import type { ExtensionDescriptor } from '@gizmo/protocol';
import type { GizmoServerExtension } from '@gizmo/extensions';

type ExtensionProvider = GizmoServerExtension &
	Required<Pick<GizmoServerExtension, 'list' | 'invoke'>>;

interface WatchState {
	listeners: Set<(extensions: ExtensionDescriptor[]) => void>;
	timer: NodeJS.Timeout;
	fingerprint: string;
}

export class ExtensionHostService {
	readonly #providers: readonly ExtensionProvider[];
	/** A recent `list` per workspace; concurrent callers share one poll. */
	readonly #cache = new Map<
		string,
		{ expiresAt: number; value: Promise<ExtensionDescriptor[]> }
	>();
	readonly #controllers = new Set<AbortController>();
	/** One poll per workspace, shared by every listener watching it. */
	readonly #watches = new Map<string, WatchState>();
	/** Entry per workspace: the owners its descriptors last reported. */
	readonly #owners = new Map<string, Map<string, ExtensionProvider>>();

	constructor(
		extensions: readonly GizmoServerExtension[],
		private readonly pollMs = 5_000,
	) {
		this.#providers = extensions.filter(
			(extension): extension is ExtensionProvider =>
				extension.list !== undefined && extension.invoke !== undefined,
		);
	}

	async list(workspacePath: string): Promise<ExtensionDescriptor[]> {
		return this.#run((signal) => this.#listUnchecked(workspacePath, signal));
	}

	async invoke(
		workspacePath: string,
		extensionId: string,
		operationId: string,
		input?: unknown,
	): Promise<unknown> {
		return this.#run(async (signal) => {
			const extensions = await this.#listUnchecked(workspacePath, signal);
			const extension = extensions.find(({ id }) => id === extensionId);
			if (!extension)
				throw new Error(`Extension is not installed: ${extensionId}`);
			const operation = extension.operations.find(
				({ id }) => id === operationId,
			);
			if (!operation)
				throw new Error(
					`Extension ${extensionId} does not expose operation: ${operationId}`,
				);
			if (operation.requiresConfirmation && !confirmed(input))
				throw new Error(
					`Extension operation requires confirmation: ${operationId}`,
				);
			const provider = this.#owners
				.get(workspacePath)
				?.get(extensionId);
			if (!provider)
				throw new Error(`Extension provider is unavailable: ${extensionId}`);
			return provider.invoke(
				workspacePath,
				extensionId,
				operationId,
				input,
				signal,
			);
		});
	}

	watch(
		workspacePath: string,
		changed: (extensions: ExtensionDescriptor[]) => void,
	): () => void {
		let state = this.#watches.get(workspacePath);
		if (!state) {
			state = {
				listeners: new Set(),
				timer: setTimeout(() => this.#check(workspacePath), this.pollMs),
				fingerprint: '',
			};
			state.timer.unref?.();
			this.#watches.set(workspacePath, state);
		}
		state.listeners.add(changed);
		return () => {
			const current = this.#watches.get(workspacePath);
			if (!current) return;
			current.listeners.delete(changed);
			if (current.listeners.size) return;
			clearTimeout(current.timer);
			this.#watches.delete(workspacePath);
		};
	}

	dispose(): void {
		for (const { timer } of this.#watches.values()) clearTimeout(timer);
		this.#watches.clear();
		for (const controller of this.#controllers) controller.abort();
		this.#controllers.clear();
		this.#owners.clear();
		this.#cache.clear();
	}

	async #check(workspacePath: string): Promise<void> {
		const state = this.#watches.get(workspacePath);
		if (!state) return;
		try {
			this.#cache.delete(workspacePath);
			const extensions = await this.list(workspacePath);
			const next = JSON.stringify(extensions);
			if (state.fingerprint && next !== state.fingerprint) {
				for (const listener of state.listeners) listener(extensions);
			}
			state.fingerprint = next;
		} catch {
			// Providers are retried on the next observation.
		}
		const current = this.#watches.get(workspacePath);
		if (!current) return;
		current.timer = setTimeout(() => this.#check(workspacePath), this.pollMs);
		current.timer.unref?.();
	}

	async #listUnchecked(workspacePath: string, signal: AbortSignal) {
		const cached = this.#cache.get(workspacePath);
		if (cached && cached.expiresAt > Date.now()) return cached.value;
		const value = Promise.all(
			this.#providers.map(async (provider) => ({
				provider,
				extensions: await provider.list(workspacePath, signal),
			})),
		)
			.then((groups) => {
				// Ownership is replaced wholesale per observation, so a stale
				// owner from a removed descriptor cannot linger.
				const owners = new Map<string, ExtensionProvider>();
				for (const { provider, extensions } of groups)
					for (const { id } of extensions) owners.set(id, provider);
				this.#owners.set(workspacePath, owners);
				return groups.flatMap(({ extensions }) => extensions);
			})
			.catch((error) => {
				this.#cache.delete(workspacePath);
				throw error;
			});
		this.#cache.set(workspacePath, {
			expiresAt: Date.now() + this.pollMs,
			value,
		});
		return value;
	}

	async #run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
		const controller = new AbortController();
		this.#controllers.add(controller);
		try {
			return await operation(controller.signal);
		} finally {
			this.#controllers.delete(controller);
		}
	}
}

function confirmed(input: unknown): boolean {
	return (
		input !== null &&
		typeof input === 'object' &&
		(input as Record<string, unknown>).confirmed === true
	);
}
