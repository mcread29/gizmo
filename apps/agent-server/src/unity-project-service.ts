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
	readonly #controllers = new Set<AbortController>();
	#projects?: UnityProject[];

	constructor(runner: UnityCommandRunner = new UnityRunner()) {
		this.#runner = runner;
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

	dispose(): void {
		for (const controller of this.#controllers) controller.abort();
		this.#controllers.clear();
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
