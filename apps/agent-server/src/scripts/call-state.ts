export const maxReportedChars = 20_000;

export type CallStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface CallRecord {
	id: string;
	label: string;
	script: string;
	cwd: string;
	status: CallStatus;
	startedAt: number;
	finishedAt?: number;
	exitCode?: number;
	stdout: string;
	stderr: string;
	truncated: boolean;
	error?: string;
}

export interface SpawnCallOptions {
	workspacePath: string;
	script: string;
	args?: readonly string[];
	label?: string;
}

/** Clamp one stream for LLM display; marks truncation like run-script. */
export function clampOutput(text: string): {
	text: string;
	truncated: boolean;
} {
	if (text.length <= maxReportedChars) return { text, truncated: false };
	return {
		text: `${text.slice(0, maxReportedChars)}\n… output truncated`,
		truncated: true,
	};
}

/** Deferred follow-up delivery: wait() consumes, settle defers, idle/settled flushes. */
export function createDeferredDelivery<T extends { id: string }>() {
	const pending = new Map<string, T>();
	return {
		defer(result: T) {
			pending.set(result.id, result);
		},
		consume(ids: Iterable<string>) {
			for (const id of ids) pending.delete(id);
		},
		drain() {
			const results = [...pending.values()];
			pending.clear();
			return results;
		},
		clear() {
			pending.clear();
		},
	};
}
