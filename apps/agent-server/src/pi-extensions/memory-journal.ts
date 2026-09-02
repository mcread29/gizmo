import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { JournalRecorder } from '../memory/journal-recorder';
import { JournalStore } from '../memory/journal-store';
import {
	createJournalTools,
	journalAvailabilityLine,
} from '../memory/journal-tools';

/**
 * Records every span that leaves the live context into the project's journal.
 *
 * The journal is the authoritative half of memory: the derived knowledge layer
 * can be discarded and rebuilt from it, so journaling must never fail loudly
 * or block a turn. Every handler here is best-effort, writes only files, and
 * calls no model.
 */
export default function memoryJournal(pi: ExtensionAPI) {
	if (process.env.GIZMO_MEMORY_JOURNAL === '0') return;
	// Keyed by workspace: one journal per project, whatever cwd a call carries.
	const stores = new Map<string, JournalStore>();
	const recorders = new Map<string, JournalRecorder>();

	const storeFor = (cwd: string): JournalStore => {
		let store = stores.get(cwd);
		if (!store) {
			store = new JournalStore(cwd);
			stores.set(cwd, store);
		}
		return store;
	};

	const forSession = (ctx: ExtensionContext): JournalRecorder => {
		let recorder = recorders.get(ctx.cwd);
		if (!recorder) {
			recorder = new JournalRecorder(storeFor(ctx.cwd));
			recorders.set(ctx.cwd, recorder);
		}
		return recorder;
	};

	for (const tool of createJournalTools(storeFor)) pi.registerTool(tool);

	/**
	 * A tool the model has never heard of is never called. Pi lists registered
	 * tools in its default system prompt, but Gizmo replaces that prompt
	 * wholesale whenever a workspace extension or the user supplies one, and
	 * the replacement carries no tool list. Appending here covers that case;
	 * the guard keeps the default prompt from naming the tools twice.
	 */
	pi.on('before_agent_start', (event) => {
		if (event.systemPrompt.includes('journal_search')) return;
		return {
			systemPrompt: `${event.systemPrompt}

${journalAvailabilityLine}`,
		};
	});

	/** A journaling failure must never take the session down with it. */
	const guard = async (label: string, work: () => Promise<unknown>) => {
		try {
			await work();
		} catch (error) {
			console.error(`Memory journal (${label}) failed:`, error);
		}
	};

	/**
	 * Compaction is the primary boundary: `firstKeptEntryId` is exactly where
	 * the rebuilt context resumes, so the segment ends there and the retained
	 * messages are left for a later span.
	 */
	pi.on('session_compact', async (event, ctx) => {
		await guard('compaction', () =>
			forSession(ctx).record(ctx.sessionManager, {
				trigger: 'compaction',
				until: event.compactionEntry.firstKeptEntryId,
			}),
		);
	});

	/**
	 * Tree navigation abandons the current branch. Recording before the move
	 * is the only chance to journal it — afterwards `getBranch()` describes the
	 * branch that was navigated to, and the abandoned work is unreachable
	 * without walking the tree.
	 */
	pi.on('session_before_tree', async (_event, ctx) => {
		await guard('branch', () =>
			forSession(ctx).record(ctx.sessionManager, { trigger: 'branch' }),
		);
	});

	/**
	 * Neither compaction nor a clean shutdown is guaranteed to happen — a crash
	 * skips both — so a large un-journaled tail is recorded opportunistically.
	 * This bounds what an abandoned session can lose.
	 */
	pi.on('turn_end', async (_event, ctx) => {
		await guard('threshold', () =>
			forSession(ctx).recordIfLarge(ctx.sessionManager),
		);
	});

	pi.on('session_shutdown', async (_event, ctx) => {
		await guard('session end', () =>
			forSession(ctx).record(ctx.sessionManager, { trigger: 'session-end' }),
		);
	});
}
