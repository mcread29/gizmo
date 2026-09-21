import { parseArgs } from './gizmo/args';
import { configureCommand } from './gizmo/configure';
import { effectiveConfig, serviceCommand } from './gizmo/service';
import {
	adoptCurrentTree,
	installRelease,
	listCommand,
	rollbackCommand,
	uninstallCommand,
	updateCommand,
} from './gizmo/install-commands';
import { appRoot, releaseManifestFile, webConfigFile } from './gizmo/paths';
import { readReleaseManifest } from './gizmo/release-download';
import { runServer } from './gizmo/run';
import { reportStatus } from './gizmo/status';

const usage = `Usage: gizmo <command>

  install [vX.Y.Z]     Fetch, verify and unpack a release; point current at it
  install --here       Point current at the tree this CLI runs from
  configure [flags]    Write ${webConfigFile()} (--show, --reset, --local,
                       --tailscale [--serve], --url <url> [--caddyfile <path>]
                       [--public], --web-port, --agent-port, --bind)
  service <verb>       install | uninstall | start | stop | restart | status
  run                  Run the server in the foreground; what the service runs
  status               Alias for \`gizmo service status\`
  update [vX.Y.Z]      Install a release beside the running one, then restart
         --no-restart  Install it and point current at it, but keep serving
  rollback             Point current at the previous release and restart
  releases             List installed releases
  uninstall [--purge]  Stop and unregister the service, then remove files
  version              Print the running version`;

async function version() {
	const manifest = await readReleaseManifest(releaseManifestFile(appRoot));
	if (!manifest) {
		console.log(`source install at ${appRoot}`);
		return;
	}
	console.log(
		`${manifest.version} (${manifest.commit.slice(0, 7)}), extension API ` +
			`${String(manifest.extensionApiVersion)}, registry ${manifest.registryRef}`,
	);
}

async function main() {
	const [verb, ...rest] = process.argv.slice(2);
	switch (verb) {
		case 'run':
			process.exitCode = await runServer(await effectiveConfig());
			return;
		case 'configure':
			await configureCommand(rest);
			return;
		case 'service':
			await serviceCommand(rest);
			return;
		case 'status':
			await reportStatus(await effectiveConfig());
			return;
		case 'install': {
			const args = parseArgs(rest, new Set());
			if (args.flags.has('here')) await adoptCurrentTree();
			else await installRelease(args.positional[0]);
			return;
		}
		case 'update': {
			const args = parseArgs(rest, new Set());
			await updateCommand(args.positional[0], {
				restart: !args.flags.has('no-restart'),
			});
			return;
		}
		case 'rollback':
			await rollbackCommand();
			return;
		case 'releases':
			await listCommand();
			return;
		case 'uninstall': {
			const args = parseArgs(rest, new Set());
			await uninstallCommand(args.flags.has('purge'), args.flags.has('yes'));
			return;
		}
		case 'version':
		case '--version':
			await version();
			return;
		case undefined:
		case 'help':
		case '--help':
			console.log(usage);
			return;
		default:
			console.error(`Unknown command: ${verb}\n\n${usage}`);
			process.exitCode = 2;
	}
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
