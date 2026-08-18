import {
	getUnityStatus,
	listUnityProjects,
	openUnityProject,
	UnityRunner,
	type UnityCommandRunner,
	type UnityOpenProjectDetails,
	type UnityProject,
	type UnityStatusDetails,
} from '@unity-agent/unity-tools';

export class UnityProjectService {
	readonly #runner: UnityCommandRunner;
	readonly #watchIntervalMs: number;
	readonly #controllers = new Set<AbortController>();
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

	async openProject(projectPath: string): Promise<UnityOpenProjectDetails> {
		await this.#requireProject(projectPath);
		return this.#run((signal) =>
			openUnityProject(this.#runner, projectPath, signal),
		);
	}

	async watchStatus(
		projectPath: string,
		listener: (status: UnityStatusDetails) => void,
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
					listener(status);
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

	async #requireProject(projectPath: string): Promise<void> {
		const projects = this.#projects ?? (await this.listProjects());
		if (!projects.some((project) => project.path === projectPath)) {
			throw new Error('The selected path is not a registered Unity project');
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
