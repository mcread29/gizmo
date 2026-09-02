import { backfillJournal } from './backfill';

/**
 * Imports historical Pi and Claude Code transcripts for one workspace into its
 * journal. Safe to re-run: already-imported sessions contribute nothing.
 *
 *   pnpm --filter @gizmo/agent-server backfill [workspacePath]
 *
 * pnpm runs package scripts with the package directory as cwd, so without an
 * explicit path the workspace defaults to where pnpm was invoked (INIT_CWD),
 * which is the repo root when run from there — not apps/agent-server.
 */
const workspacePath = process.argv[2] ?? process.env.INIT_CWD ?? process.cwd();
const result = await backfillJournal({ workspacePath });

const bySource = new Map<string, number>();
let messages = 0;
for (const meta of result.imported) {
	bySource.set(
		meta.source ?? 'live',
		(bySource.get(meta.source ?? 'live') ?? 0) + 1,
	);
	messages += meta.messages;
}

console.log(`Workspace: ${workspacePath}`);
console.log(`Sessions found:    ${result.scanned}`);
console.log(
	`Segments written:  ${result.imported.length} (${messages} messages)`,
);
for (const [source, count] of bySource) console.log(`  ${source}: ${count}`);
console.log(`Already imported:  ${result.skipped}`);
