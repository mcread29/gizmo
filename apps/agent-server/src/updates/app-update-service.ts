import { spawn } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUpdateStatus } from '@gizmo/protocol';
import {
	compareVersions,
	installedVersion,
	latestVersion,
	type InstallInfo,
	type LatestInfo,
} from './app-update-source';

export interface AppUpdateHooks {
	/** Tells every connection where the update stands. */
	broadcast(status: AppUpdateStatus): void;
	/**
	 * Called once the new release is installed and `current` points at it.
	 * The server exits and its supervisor starts whatever `current` is now.
	 */
	restart(): void;
}

export interface AppUpdateOptions {
	/** The tree the server runs from: what `gizmo update` upgrades. */
	root: string;
	/** How long a check for the latest release stays fresh. */
	checkTtlMs?: number;
	now?: () => number;
	describe?: (root: string) => Promise<InstallInfo>;
	latest?: (install: InstallInfo, root: string) => Promise<LatestInfo>;
	spawnCli?: typeof spawn;
	/** How long the restart notice gets to reach every tab before the exit. */
	restartDelayMs?: number;
}

type Progress = Pick<AppUpdateStatus, 'phase' | 'target' | 'message'>;

/**
 * Updates Gizmo from inside Gizmo. The heavy lifting is `gizmo update
 * --no-restart`, the same CLI a shell would run: it downloads, verifies and
 * unpacks the release beside the running one, installs its dependencies,
 * and only then moves `current`. So a failure at any step leaves this
 * server serving the release it started with. On success the server exits
 * and its supervisor brings up `current`, which is now the new release.
 */
export class AppUpdateService {
	readonly #root: string;
	readonly #ttl: number;
	readonly #now: () => number;
	readonly #describe: (root: string) => Promise<InstallInfo>;
	readonly #latest: (install: InstallInfo, root: string) => Promise<LatestInfo>;
	readonly #spawn: typeof spawn;
	readonly #restartDelay: number;
	#hooks: AppUpdateHooks = { broadcast: () => {}, restart: () => {} };
	#install?: InstallInfo;
	#check?: { at: number; latest?: LatestInfo; error?: string };
	#progress: Progress = { phase: 'idle' };

	constructor(options: AppUpdateOptions) {
		this.#root = options.root;
		this.#ttl = options.checkTtlMs ?? 10 * 60_000;
		this.#now = options.now ?? Date.now;
		this.#describe = options.describe ?? installedVersion;
		this.#latest = options.latest ?? latestVersion;
		this.#spawn = options.spawnCli ?? spawn;
		this.#restartDelay = options.restartDelayMs ?? 1_000;
	}

	configure(hooks: AppUpdateHooks) {
		this.#hooks = hooks;
	}

	/** The running version, and the latest unless the last check is recent. */
	async status(refresh = false): Promise<AppUpdateStatus> {
		const install = await this.#installed();
		const stale = !this.#check || this.#now() - this.#check.at > this.#ttl;
		if (refresh || stale) {
			try {
				this.#check = {
					at: this.#now(),
					latest: await this.#latest(install, this.#root),
				};
			} catch (error) {
				this.#check = { at: this.#now(), error: (error as Error).message };
			}
		}
		return this.#compose(install);
	}

	/**
	 * Returns as soon as the CLI is running; the outcome is broadcast. A
	 * second start while one is under way is refused rather than queued.
	 */
	async start(version?: string): Promise<AppUpdateStatus> {
		if (this.#progress.phase !== 'idle' && this.#progress.phase !== 'failed')
			throw new Error('An update is already under way.');
		const install = await this.#installed();
		if (install.kind === 'source' && version)
			throw new Error('A source checkout updates to its branch tip only.');
		const target = version ?? this.#check?.latest?.version ?? 'latest';
		this.#setProgress({ phase: 'installing', target, message: 'Starting…' });
		this.#runCli(version);
		return this.#compose(install);
	}

	#runCli(version?: string) {
		const args = [
			join(this.#root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
			join(this.#root, 'scripts', 'gizmo.ts'),
			'update',
			'--no-restart',
			...(version ? [version] : []),
		];
		const child = this.#spawn(process.execPath, args, {
			cwd: this.#root,
			env: {
				...process.env,
				CI: process.env.CI || 'true',
				PATH: [dirname(process.execPath), process.env.PATH]
					.filter(Boolean)
					.join(delimiter),
			},
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});
		const tail: string[] = [];
		const note = (chunk: Buffer | string) => {
			const text = String(chunk);
			process.stdout.write(text);
			for (const line of text.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				tail.push(trimmed);
				if (tail.length > 20) tail.shift();
			}
			if (tail.length)
				this.#setProgress({ ...this.#progress, message: tail.at(-1) });
		};
		child.stdout?.on('data', note);
		child.stderr?.on('data', note);
		child.once('error', (error) =>
			this.#setProgress({
				...this.#progress,
				phase: 'failed',
				message: error.message,
			}),
		);
		child.once('exit', (code) => {
			if (code !== 0) {
				this.#setProgress({
					...this.#progress,
					phase: 'failed',
					message:
						tail.slice(-5).join('\n') ||
						`gizmo update exited with code ${String(code)}`,
				});
				return;
			}
			this.#setProgress({
				...this.#progress,
				phase: 'restarting',
				message: 'Installed. Restarting Gizmo…',
			});
			setTimeout(() => this.#hooks.restart(), this.#restartDelay);
		});
	}

	#setProgress(progress: Progress) {
		this.#progress = progress;
		if (this.#install) this.#hooks.broadcast(this.#compose(this.#install));
	}

	async #installed() {
		this.#install ??= await this.#describe(this.#root);
		return this.#install;
	}

	#compose(install: InstallInfo): AppUpdateStatus {
		const latest = this.#check?.latest;
		const updateAvailable =
			latest !== undefined &&
			(install.kind === 'source'
				? latest.commit !== install.commit
				: compareVersions(latest.version, install.version) > 0);
		return {
			install: install.kind,
			version: install.version,
			root: this.#root,
			...(latest ? { latest: latest.version } : {}),
			updateAvailable,
			...(this.#check ? { checkedAt: this.#check.at } : {}),
			...(this.#check?.error ? { checkError: this.#check.error } : {}),
			phase: this.#progress.phase,
			...(this.#progress.target ? { target: this.#progress.target } : {}),
			...(this.#progress.message !== undefined
				? { message: this.#progress.message }
				: {}),
		};
	}
}

/** The tree this server runs from: four levels above this file. */
export const serverRoot = () =>
	join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * One instance per process: an update is process-wide state, and every
 * connection reads and drives the same one.
 */
export const appUpdates = new AppUpdateService({ root: serverRoot() });
