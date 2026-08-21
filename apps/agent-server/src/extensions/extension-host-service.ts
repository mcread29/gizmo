import type { ExtensionDescriptor } from '@gizmo/protocol';
import type { GizmoServerExtension } from '@gizmo/extensions';

type ExtensionProvider = GizmoServerExtension &
	Required<Pick<GizmoServerExtension, 'list' | 'invoke'>>;

export class ExtensionHostService {
	readonly #providers: readonly ExtensionProvider[];
	readonly #cache = new Map<
		string,
		{ expiresAt: number; value: Promise<ExtensionDescriptor[]> }
	>();
	readonly #controllers = new Set<AbortController>();
	readonly #watchStops = new Set<() => void>();
	readonly #owners = new Map<string, ExtensionProvider>();

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
			if (!extension) throw new Error(`Extension is not installed: ${extensionId}`);
			const operation = extension.operations.find(({ id }) => id === operationId);
			if (!operation)
				throw new Error(`Extension ${extensionId} does not expose operation: ${operationId}`);
			if (operation.requiresConfirmation && !confirmed(input))
				throw new Error(`Extension operation requires confirmation: ${operationId}`);
			const provider = this.#owners.get(`${workspacePath}:${extensionId}`);
			if (!provider) throw new Error(`Extension provider is unavailable: ${extensionId}`);
			return provider.invoke(workspacePath, extensionId, operationId, input, signal);
		});
	}

	watch(workspacePath: string, changed: (extensions: ExtensionDescriptor[]) => void): () => void {
		let disposed = false;
		let fingerprint = '';
		const check = async () => {
			try {
				this.#cache.delete(workspacePath);
				const extensions = await this.list(workspacePath);
				const next = JSON.stringify(extensions);
				if (fingerprint && next !== fingerprint) changed(extensions);
				fingerprint = next;
			} catch {
				// Providers are retried on the next observation.
			} finally {
				if (!disposed) timer = setTimeout(check, this.pollMs);
			}
		};
		let timer = setTimeout(check, this.pollMs);
		const stop = () => {
			disposed = true;
			clearTimeout(timer);
			this.#watchStops.delete(stop);
		};
		this.#watchStops.add(stop);
		return stop;
	}

	dispose(): void {
		for (const stop of this.#watchStops) stop();
		for (const controller of this.#controllers) controller.abort();
		this.#controllers.clear();
		this.#cache.clear();
		this.#owners.clear();
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
				for (const { provider, extensions } of groups)
					for (const { id } of extensions)
						this.#owners.set(`${workspacePath}:${id}`, provider);
				return groups.flatMap(({ extensions }) => extensions);
			})
			.catch((error) => {
				this.#cache.delete(workspacePath);
				throw error;
			});
		this.#cache.set(workspacePath, { expiresAt: Date.now() + this.pollMs, value });
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
	return input !== null && typeof input === 'object' && (input as Record<string, unknown>).confirmed === true;
}
