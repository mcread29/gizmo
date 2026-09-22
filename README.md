<img src="apps/app/src/assets/gizmo-logo.svg" width="88" height="88" alt="Gizmo logo">

# Gizmo

An open source, extensible AI workbench built on Pi. Extensions add
first-class support for Unity, Svelte, and other project ecosystems without
forking the product.

## Install

Gizmo installs into `~/.gizmo` and is then run by your platform's own
supervisor — a systemd user unit, a launchd agent, or a Windows scheduled
task. It needs Node 24 or newer, pnpm 11 or newer (`corepack enable`), and
`git`; the last because extensions are cloned and built on your machine at
runtime rather than shipped prebuilt. Tailscale is optional and only used by
the remote-access profiles below.

On macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/mcread29/gizmo/main/scripts/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/mcread29/gizmo/main/scripts/install.ps1 | iex
```

Either one checks those prerequisites, downloads the latest release tarball,
verifies it against the published `SHA256SUMS`, unpacks it under
`~/.gizmo/app/releases/`, installs its dependencies, and puts a `gizmo` shim on
your PATH. It stops there: a script you piped into a shell should not register
a background service. Two commands finish the job, and the installer prints
them.

```sh
gizmo configure --local
gizmo service install && gizmo service start
```

Then open <http://localhost:4173>.

> On Windows, `gizmo service install` is the one step that needs an elevated
> console: only an elevated token may register a scheduled task. `configure`,
> `start`, `stop`, `restart` and `status` do not.

### From a checkout

Running `main` is a supported way to install, not just to develop — it is what
the maintainer's own instance does. Clone the repository, then:

```sh
pnpm install
pnpm build
pnpm gizmo configure --local
pnpm gizmo service install && pnpm gizmo service start
```

The supervisor is pointed at the checkout, so `git pull && pnpm install` and a
`pnpm gizmo service restart` is the whole update story. There is no compiled
backend: the server runs from source under `tsx`, and `pnpm build` is only for
the browser bundle.

### Reaching it from somewhere other than the machine it runs on

`gizmo configure` decides which hosts the app answers on, and the profiles
compose — a real instance often uses two of them at once.

| Command                                        | What you get                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gizmo configure --local`                      | `localhost` and `127.0.0.1` only. The default.                                                                                                                                            |
| `gizmo configure --tailscale --serve`          | `https://<magicdns-name>`, with a real certificate, reachable by tailnet members only. The one to pick if you have Tailscale.                                                              |
| `gizmo configure --tailscale`                  | Plain HTTP on the tailnet IP and MagicDNS name. Vite binds the Tailscale address alone, so the LAN never sees the port.                                                                    |
| `gizmo configure --url https://gizmo.example`  | A domain you own: a DNS-only (unproxied) A record pointing at this node's tailnet IP, plus a TLS front you run. `configure` prints the Caddyfile, and refuses a name that resolves publicly unless you pass `--public`. |

Any of them rewrites `~/.gizmo/web.json` and takes effect on
`gizmo service restart`. See [Always-on web server](#always-on-web-server)
below for what that file holds and how the bind address is derived from it.

### Updating, rolling back, removing

```sh
gizmo update              # fetch the newest release and restart; the previous one is kept
gizmo rollback            # point back at it
gizmo uninstall --purge   # unregister the service and delete ~/.gizmo
```

Two releases are kept at a time. Both forms of uninstall list what they are
about to delete and ask before doing it; without `--purge`, uninstall
unregisters the service and removes the installed app tree, leaving your
threads, settings, and extensions where they are.
[docs/release.md](docs/release.md) covers the layout under `~/.gizmo`, the
version contract between the app and the extension registry, and exactly what
uninstall does and does not delete.

## Architecture

Gizmo stores user-selected workspaces in its app data directory, while each
workspace owns its configuration overrides under `.gizmo/config.json`. A
workspace follows the global settings — Gizmo extensions, Pi extensions,
skills, and built-in tools — until it overrides individual items. Gizmo never
guesses a workspace type: adding one enables nothing and inspects nothing.
See [`docs/project-configuration.md`](docs/project-configuration.md)
and [`docs/extensions.md`](docs/extensions.md).

Gizmo extensions are installed globally and on by default; Pi extensions and
skills are managed in Settings → Agent, and any of them can be overridden per
workspace in its Configure screen.

The included `display` tool renders formatted cards, tables, lists, and metrics
in chat using json-render. It can also wait for a text answer, selection, or
confirmation. See [`docs/chat-display.md`](docs/chat-display.md).

## Development

Work happens on local scratch branches and reaches `main` as squash commits,
one per release; there are no remote feature branches or pull requests. The
details, and the other conventions an agent or contributor is expected to
follow, are in [AGENTS.md](AGENTS.md).

Install dependencies and start both the Svelte app and local Pi agent server:

```sh
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The Vite development server proxies `/agent` to
the local WebSocket server on port `8787`.

To run the full Gizmo web interface against Pi's default runtime, run:

```sh
pnpm pi-web:dev
```

For a background Pi Web server managed without a persistent terminal, use:

```sh
pnpm dev:server:start
pnpm dev:server:status
pnpm dev:server:restart
pnpm dev:server:stop
```

Output is appended to `.gizmo-dev/dev-server.log`; runtime PID state stays in
that ignored directory. The agent server runs under `tsx watch`, so edits to
`apps/agent-server` or any package it imports (`protocol`, `extensions`) restart
it in place and the browser reconnects; Vite hot-reloads the app as usual.

That is the *dev* server, which you own. The live one at
<https://gizmo.genge.init0.link> is run by a scheduled task instead, and must
not be started by hand — `pnpm gizmo status` reports whether it is up, and
[docs/web-server.md](docs/web-server.md) covers how to restart it.

Pi Web keeps Gizmo's thread, workspace, settings, Git, and extension UI. New
threads use Pi's standard built-in tools and discover the resources configured
under `~/.pi/agent`: packages, extensions, skills, prompt templates, context
files, settings, models, and providers. Project-local executable resources obey
Pi's saved project-trust decisions and `defaultProjectTrust` setting. Gizmo's
workspace extensions remain available, but their custom system-prompt override
is not applied in this mode. **Reload runtime** on Settings → Agent reloads the
selected thread's Pi extensions, skills, prompts, packages, and context files.
Typing `/` in the composer opens the active thread's extension commands, prompt
templates, and skills; skills are inserted using Pi's `/skill:name` syntax.

Pi conversations are stored as JSONL under `~/.gizmo/sessions`. The app
restores the last selected session and project on reconnect. Set
`GIZMO_DATA_DIR` to use a different application-data directory.

In normal Gizmo mode, the backend keeps Pi SDK configuration in Gizmo's
application-data directory: `auth.json`, `settings.json`, `models.json`, and
`models-store.json` live beside the `sessions` directory. Missing files are
initially copied from `~/.pi/agent` without overwriting Gizmo-owned state. Pi Web
instead reads those runtime files directly from `~/.pi/agent`, so authentication
and model changes made by Pi are available to new threads without a copy step.

Browser WebSockets are restricted to the local Vite origin by default. Set a
comma-separated `GIZMO_ORIGINS` value when intentionally serving the UI
from another origin.

The Unity tools are `unity_status`, `unity_list_commands`, `unity_command`,
`unity_console`, `unity_wait_for_compile`, `unity_wait_for_command`,
`unity_test`, `unity_script`, and `unity_command_template`. Command discovery
returns the live Editor schemas, supports text filtering, and is refreshed
before every execution.
`unity_command` accepts validated named parameters or raw argument arrays for
unusual custom command syntax. After the agent authors an Editor-side command,
`unity_wait_for_command` forces compilation, waits through the domain reload,
reports compiler errors, and verifies the command's live registration.
`unity_script` composes several approved CLI and connected-Editor operations
in one type-checked TypeScript script, with command types generated from the
live Editor entirely in memory (no Node, filesystem, shell, or package
imports). `unity_command_template` supplies a reusable starter matching the
current Pipeline command API before project-specific Editor code is written.

Successful writes and edits to C#, assembly definitions, compiler response
files, and `Packages/manifest.json` mark the thread as pending compilation.
`unity_wait_for_compile` clears that state after compilation and collects only
new warning/error console entries. `unity_test` runs focused synchronous tests
in the connected Editor and returns linked per-test results.

## Always-on web server

An installed Gizmo is run by the platform's own supervisor — a systemd user
unit, a launchd agent, or a Windows scheduled task — rather than by a pnpm
script. The `gizmo` command is the whole interface:

```sh
gizmo configure --local      # or --tailscale [--serve], or --url https://gizmo.example
gizmo service install        # register with the supervisor, then start it
gizmo status                 # probe both ports and every configured URL
gizmo service restart        # apply a configuration change
```

In a checkout, the same CLI is `pnpm gizmo <verb>`. Build the browser bundle
first with `pnpm build`; the server itself runs from source under `tsx`.

`gizmo configure` writes `~/.gizmo/web.json` — the two ports, the bind address,
and every URL the app is reached by. Those URLs become both Vite's allowed-host
list and the agent server's WebSocket origin allowlist, so a host missing from
them shows up as an app that loads and then never connects. The bind address is
derived from the URLs: loopback when they are all local, the Tailscale address
when they are all tailnet names, otherwise every interface.

[docs/web-server.md](docs/web-server.md) covers the verbs and the live
instance; [docs/release.md](docs/release.md) covers installing, updating, and
rolling back.

The lower-level discovery commands are:

```sh
unity --non-interactive --no-banner --format json status
unity --non-interactive --no-banner --format json list --project-path <path>
```

Their connected Editor state and discovered Pipeline commands are shown in the
inspector after the agent invokes them. The harness intentionally grants its
configured tools full access without approval prompts and disables ambient Pi
extensions. The Changes view is the review surface for project mutations.

Unity-hosted project extensions use the generic extension boundary documented in
[`docs/extensions.md`](docs/extensions.md). Core discovers versioned descriptors
and forwards declared operations without interpreting extension payloads.
Candidate extensions are collected in
[`docs/extension-ideas.md`](docs/extension-ideas.md).

Skills, `AGENTS.md` files, prompt templates, and Pi extensions use Pi's global
folders under `~/.pi/agent` plus cross-harness skills under `~/.agents/`.
Gizmo edits skill Markdown in place, can disable global Pi extensions without
deleting them, and supports skill and extension overrides per workspace; see
[`docs/resources.md`](docs/resources.md).

```sh
pnpm check
pnpm test
pnpm build
```
