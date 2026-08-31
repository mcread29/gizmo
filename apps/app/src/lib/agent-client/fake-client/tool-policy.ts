import {
	builtInAgentTools,
	seededToolPolicy,
	type ToolPolicy,
} from '@gizmo/protocol';
import type { FakeClientState } from './state';

export class FakeToolPolicyCapability {
	constructor(private readonly state: FakeClientState) {}

	async get(workspacePath?: string) {
		this.state.assertConnected();
		return this.catalog(workspacePath);
	}

	async setGlobal(tools: string[]) {
		this.state.assertConnected();
		this.state.globalToolPolicy = this.normalize(tools);
		return this.catalog();
	}

	async setProject(workspacePath: string, tools: string[] | null) {
		this.state.assertConnected();
		this.state.assertProject(workspacePath);
		if (tools === null) this.state.projectToolPolicies.delete(workspacePath);
		else this.state.projectToolPolicies.set(workspacePath, tools);
		return this.catalog(workspacePath);
	}

	catalog(workspacePath?: string): ToolPolicy {
		const project = workspacePath
			? (this.state.projectToolPolicies.get(workspacePath) ?? null)
			: null;
		return {
			builtIn: [...builtInAgentTools],
			global: [...this.state.globalToolPolicy],
			project,
			effective: project ??
				this.state.globalToolPolicy ?? [...builtInAgentTools],
			projectApplied: project !== null,
		};
	}

	private normalize(tools: string[]) {
		const known = new Set<string>(builtInAgentTools);
		const normalized = [...new Set(tools)].filter((tool) => known.has(tool));
		if (normalized.length !== tools.length) {
			throw new Error('Tool policy may only name built-in tools');
		}
		return normalized;
	}
}

export function initialToolPolicy() {
	return [...seededToolPolicy];
}
