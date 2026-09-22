import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { uptime } from 'node:os';
import { releaseManifestFile, runningStateFile, webPidFile } from './paths';
import { readReleaseManifest } from './release-download';

/**
 * What `gizmo run` records about itself. `current` names the release that
 * *should* be serving; this names the one that is. Without it an update that
 * moved the link but failed to restart looks finished from every angle: the
 * link is new, the ports answer, and the old server keeps serving.
 */
export interface RunningServer {
	pid: number;
	/** The release tag serving, or `source` for a checkout. */
	version: string;
	root: string;
	startedAt: string;
}

/** What a tree would serve if it were started: its release tag, or `source`. */
export async function treeVersion(root: string): Promise<string> {
	const manifest = await readReleaseManifest(releaseManifestFile(root));
	return manifest?.version ?? 'source';
}

/**
 * Whether `pid` is still a running Gizmo rather than a number the system
 * handed to something else after a crash. Windows can say what a pid is;
 * elsewhere a service manager stops the tree it started, so liveness is as
 * much as a stale record needs.
 */
export function isLiveServer(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	if (process.platform === 'win32') {
		const listed = spawnSync(
			'tasklist.exe',
			['/FI', `PID eq ${String(pid)}`, '/NH'],
			{ encoding: 'utf8', windowsHide: true },
		);
		return /node\.exe/i.test(listed.stdout ?? '');
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether something written at `time` can still describe a live server.
 * Nothing written before this machine last booted can: a crash or a power
 * cut skips the cleanup that removes the record, and a pid from before the
 * reboot is by then just a number some unrelated process may have been
 * given — which would make every start refuse, forever, to run behind it.
 * The slack absorbs the clock being stepped while the machine comes up.
 */
function sinceBoot(time: number): boolean {
	const bootedAt = Date.now() - uptime() * 1000;
	return Number.isFinite(time) && time >= bootedAt - 30_000;
}

function readRecord(): RunningServer | null {
	try {
		const record = JSON.parse(
			readFileSync(runningStateFile(), 'utf8'),
		) as RunningServer;
		return Number.isInteger(record.pid) &&
			sinceBoot(Date.parse(record.startedAt))
			? record
			: null;
	} catch {
		return null;
	}
}

/**
 * The pid of whatever last claimed the ports. Releases older than this file
 * wrote only `web.pid`, so that is the fallback: during the one update that
 * introduces the record, the server being replaced is still findable.
 */
function recordedPid(): number | null {
	const record = readRecord();
	if (record) return record.pid;
	try {
		if (!sinceBoot(statSync(webPidFile()).mtimeMs)) return null;
		const pid = Number(readFileSync(webPidFile(), 'utf8').trim());
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

/** The server that is serving now, or `null` when none of ours is. */
export function runningServer(): RunningServer | null {
	const record = readRecord();
	return record && isLiveServer(record.pid) ? record : null;
}

/** The release actually serving, or `null` when that cannot be established. */
export const runningVersion = (): string | null =>
	runningServer()?.version ?? null;

/**
 * Records this process as the server. A start that is about to lose the
 * ports to the server it meant to replace must not overwrite that server's
 * record: `service stop` reads it to end the tree, and a clobbered record
 * leaves the live server unreachable by anything but Task Manager.
 */
export async function recordRunningServer(root: string, pid = process.pid) {
	const other = recordedPid();
	if (other !== null && other !== pid && isLiveServer(other)) {
		throw new Error(
			`Gizmo is already running as pid ${String(other)}. Stop it with ` +
				'`gizmo service stop` before starting another server.',
		);
	}
	const record: RunningServer = {
		pid,
		version: await treeVersion(root),
		root,
		startedAt: new Date().toISOString(),
	};
	writeFileSync(runningStateFile(), `${JSON.stringify(record, null, '\t')}\n`);
	writeFileSync(webPidFile(), String(pid));
}

/** Clears the record on the way out, but only while it still names `pid`. */
export function clearRunningServer(pid = process.pid) {
	const owner = recordedPid();
	if (owner !== null && owner !== pid) return;
	forgetRunningServer();
}

/** Drops the record outright: what `service stop` does once the tree is gone. */
export function forgetRunningServer() {
	rmSync(runningStateFile(), { force: true });
	rmSync(webPidFile(), { force: true });
}
