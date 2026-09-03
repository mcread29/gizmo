<img src="apps/app/src/assets/gizmo-logo.svg" width="88" height="88" alt="Gizmo logo">

# Gizmo

An open source, extensible AI workbench built on Pi. Extensions add
first-class support for Unity, Svelte, and other project ecosystems without
forking the product.

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

## Development

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

`pnpm web:server:start` runs the production stack in the background: the agent
server on loopback, plus `vite preview` serving the built app and proxying
`/agent` through to it. Build first with `pnpm build`.

```sh
pnpm build
pnpm web:server:start
pnpm web:server:status
pnpm web:server:stop
```

`GIZMO_WEB_PORT` (default 4173) and `GIZMO_PORT` (default 8787) set the ports.
`GIZMO_WEB_HOSTS` is a comma-separated list of the hostnames the app is reached
by; it becomes both the allowed-host list for the web server and the allowed
WebSocket origins for the agent server, so add an entry for any LAN or Tailscale
name you want to use.

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
