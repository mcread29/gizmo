import { effectiveConfig } from './gizmo/service';
import { runServer } from './gizmo/run';
import { reportStatus } from './gizmo/status';

/**
 * A shim. Everything this used to do lives in `scripts/gizmo.ts` now, but the
 * path is baked into service definitions that predate it, so `run` has to keep
 * meaning what it meant. Once `gizmo service install` has rewritten the
 * machine's service definition, nothing invokes this file and it can go.
 */
async function main() {
	const verb = process.argv[2];
	if (verb === 'status') {
		await reportStatus(await effectiveConfig());
		return;
	}
	if (verb !== 'run') {
		console.error(
			'Usage: pnpm web:server <run|status>  (use `pnpm gizmo` instead)',
		);
		process.exitCode = 2;
		return;
	}
	process.exitCode = await runServer(await effectiveConfig());
}

void main().catch((error: unknown) => {
	console.error(
		error instanceof Error ? (error.stack ?? error.message) : String(error),
	);
	process.exitCode = 1;
});
