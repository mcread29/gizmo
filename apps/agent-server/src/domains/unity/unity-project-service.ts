import { access, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import {
	getUnityStatus,
	invokeUnityExtension,
	listUnityCommands,
	listUnityExtensions,
	listUnityProjects,
	openUnityProject,
	unityExtensionCommands,
	UnityRunner,
	type UnityCommandRunner,
	type UnityExtensionDescriptor,
	type UnityOpenProjectDetails,
	type UnityProject,
	type UnityStatusDetails,
} from '@unity-agent/unity-tools';
import { revertPatch } from '../../tools/patch';

export interface ProjectWatchListeners {
	status: (status: UnityStatusDetails) => void;
	extensions: (extensions: UnityExtensionDescriptor[]) => void;
}

export class UnityProjectService {
	readonly #runner: UnityCommandRunner;
	readonly #watchIntervalMs: number;
	readonly #controllers = new Set<AbortController>();
	readonly #extensionCache = new Map<
		string,
		{ expiresAt: number; value: Promise<UnityExtensionDescriptor[]> }
	>();
	#projects?: UnityProject[];
	#watch?: { controller: AbortController; timer?: NodeJS.Timeout };

	constructor(
		runner: UnityCommandRunner = new UnityRunner(),
		watchIntervalMs = 1_000,
	) {
		this.#runner = runner;
		this.#watchIntervalMs = watchIntervalMs;
	}

	async listProjects(): Promise<UnityProject[]> {
		return this.#run(async (signal) => {
			const result = await listUnityProjects(this.#runner, signal);
			if (!result.ok) {
				throw new Error(
					result.errors[0]?.message ?? 'Could not list Unity projects',
				);
			}
			this.#projects = result.projects;
			return result.projects;
		});
	}

	async getStatus(projectPath: string): Promise<UnityStatusDetails> {
		await this.#requireProject(projectPath);
		return this.#run((signal) =>
			getUnityStatus(this.#runner, { projectPath, signal }),
		);
	}

	async listExtensions(
		projectPath: string,
	): Promise<UnityExtensionDescriptor[]> {
		await this.#requireProject(projectPath);
		return this.#run((signal) =>
			this.#listExtensionsUnchecked(projectPath, signal),
		);
	}

	async invokeExtension(
		projectPath: string,
		extensionId: string,
		operationId: string,
		input?: unknown,
	): Promise<unknown> {
		await this.#requireProject(projectPath);
		return this.#run(async (signal) => {
			const extensions = await this.#listExtensionsUnchecked(
				projectPath,
				signal,
			);
			const extension = extensions.find(({ id }) => id === extensionId);
			if (!extension)
				throw new Error(`Extension is not installed: ${extensionId}`);
			const operation = extension.operations.find(
				({ id }) => id === operationId,
			);
			if (!operation) {
				throw new Error(
					`Extension ${extensionId} does not expose operation: ${operationId}`,
				);
			}
			if (operation.requiresConfirmation && !confirmed(input)) {
				throw new Error(
					`Extension operation requires confirmation: ${operationId}`,
				);
			}
			return invokeUnityExtension(
				this.#runner,
				projectPath,
				extensionId,
				operationId,
				input,
				signal,
			);
		});
	}

	/**
	 * Undoes one recorded edit. Refuses paths outside the project and patches
	 * that no longer describe the file, so a stale change cannot corrupt work
	 * done after it.
	 */
	async revertFile(
		projectPath: string,
		file: string,
		patch: string,
	): Promise<void> {
		await this.#requireProject(projectPath);
		const target = isAbsolute(file)
			? resolve(file)
			: resolve(projectPath, file);
		const within = relative(resolve(projectPath), target);
		if (within.startsWith('..') || isAbsolute(within)) {
			throw new Error('That file is outside the selected project');
		}
		const content = await readFile(target, 'utf8');
		await writeFile(target, revertPatch(content, patch), 'utf8');
	}

	async openProject(projectPath: string): Promise<UnityOpenProjectDetails> {
		await this.#requireProject(projectPath);
		return this.#run((signal) =>
			openUnityProject(this.#runner, projectPath, signal),
		);
	}

	/**
	 * Polls Editor status on one timer and reports only changes.
	 */
	async watchStatus(
		projectPath: string,
		listeners: ProjectWatchListeners,
	): Promise<UnityStatusDetails> {
		await this.#requireProject(projectPath);
		this.#stopWatching();
		const initial = await this.getStatus(projectPath);
		const controller = new AbortController();
		const watch: { controller: AbortController; timer?: NodeJS.Timeout } = {
			controller,
		};
		this.#watch = watch;
		let fingerprint = statusFingerprint(initial);
		let extensionFingerprint = extensionListFingerprint(
			await this.#listExtensionsUnchecked(projectPath, controller.signal),
		);
		let nextExtensionCheck = Date.now() + 5_000;

		const poll = async () => {
			if (controller.signal.aborted) return;
			try {
				const status = await getUnityStatus(this.#runner, {
					projectPath,
					signal: controller.signal,
				});
				const nextFingerprint = statusFingerprint(status);
				if (nextFingerprint !== fingerprint) {
					fingerprint = nextFingerprint;
					listeners.status(status);
				}
				if (Date.now() >= nextExtensionCheck) {
					nextExtensionCheck = Date.now() + 5_000;
					const extensions = await this.#listExtensionsUnchecked(
						projectPath,
						controller.signal,
					);
					const nextExtensions = extensionListFingerprint(extensions);
					if (nextExtensions !== extensionFingerprint) {
						extensionFingerprint = nextExtensions;
						listeners.extensions(extensions);
					}
				}
			} catch {
				// The next observation retries transient runner failures.
			} finally {
				if (!controller.signal.aborted) {
					watch.timer = setTimeout(poll, this.#watchIntervalMs);
					watch.timer.unref();
				}
			}
		};

		watch.timer = setTimeout(poll, this.#watchIntervalMs);
		watch.timer.unref();
		return initial;
	}

	dispose(): void {
		this.#stopWatching();
		for (const controller of this.#controllers) controller.abort();
		this.#controllers.clear();
	}

	#stopWatching(): void {
		if (!this.#watch) return;
		this.#watch.controller.abort();
		if (this.#watch.timer) clearTimeout(this.#watch.timer);
		this.#watch = undefined;
	}

	async #listExtensionsUnchecked(
		projectPath: string,
		signal: AbortSignal,
	): Promise<UnityExtensionDescriptor[]> {
		const cached = this.#extensionCache.get(projectPath);
		if (cached && cached.expiresAt > Date.now()) return cached.value;
		const value = this.#discoverExtensions(projectPath, signal).catch(
			(error) => {
				this.#extensionCache.delete(projectPath);
				throw error;
			},
		);
		this.#extensionCache.set(projectPath, {
			expiresAt: Date.now() + 5_000,
			value,
		});
		return value;
	}

	async #discoverExtensions(
		projectPath: string,
		signal: AbortSignal,
	): Promise<UnityExtensionDescriptor[]> {
		const commands = await listUnityCommands(this.#runner, {
			projectPath,
			signal,
		});
		if (
			!commands.ok ||
			!commands.commands.some(
				(command) => command.name === unityExtensionCommands.discoveryCommand,
			)
		) {
			return [];
		}
		const details = await listUnityExtensions(
			this.#runner,
			projectPath,
			signal,
		);
		return details.ok ? details.extensions : [];
	}

	async #requireProject(projectPath: string): Promise<void> {
		try {
			const projects = this.#projects ?? (await this.listProjects());
			if (projects.some((project) => project.path === projectPath)) return;
		} catch {
			// A user-selected project does not have to be in the Hub registry.
		}
		try {
			await access(resolve(projectPath, 'ProjectSettings'));
		} catch {
			throw new Error('The selected path is not a Unity project');
		}
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

function statusFingerprint(status: UnityStatusDetails): string {
	return JSON.stringify({
		state: status.state,
		ok: status.ok,
		exitCode: status.exitCode,
		instances: status.instances,
		errors: status.errors,
		warnings: status.warnings,
		stderr: status.stderr,
	});
}

function extensionListFingerprint(
	extensions: readonly UnityExtensionDescriptor[],
): string {
	return JSON.stringify(extensions);
}

function confirmed(input: unknown): boolean {
	return (
		input !== null &&
		typeof input === 'object' &&
		(input as Record<string, unknown>).confirmed === true
	);
}
