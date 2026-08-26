<img src="apps/app/src/assets/gizmo-logo.svg" width="88" height="88" alt="Gizmo logo">

# Gizmo

An open source, extensible AI workbench built on Pi. Extensions add
first-class support for Unity, Svelte, and other project ecosystems without
forking the product.

## Architecture

Gizmo stores user-selected workspaces in its app data directory, while each
workspace owns its agent profiles under `.gizmo/profiles.json`. A profile
selects the prompt fragments, tools, skills, and extension contributions that
shape new threads. Extension packages such as Unity and Svelte provide profile
defaults, but the saved project profile is the source of truth once copied into
the workspace. See [`docs/workspace-profiles.md`](docs/workspace-profiles.md)
and [`docs/extensions.md`](docs/extensions.md).

The default profile keeps Pi's default system prompt unchanged, plus any skills
enabled through Gizmo's global and profile-local settings.

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
`GIZMO_DATA_DIR` to use a different application-data directory. The older
`UNITY_AGENT_DATA_DIR` name remains supported for migration.

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

## Desktop

The Tauri app compiles the TypeScript agent server into a self-contained Bun
sidecar, starts it on loopback, waits until it is ready, and terminates it with
the desktop application. A system Node installation is not required.

```sh
pnpm desktop:dev
pnpm desktop:build
```

The build script names the sidecar for the local Rust target triple. Desktop
bundles are written under `apps/app/src-tauri/target/release/bundle`.

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

Skills, `AGENTS.md` files, and prompt templates are loaded from Gizmo's own
folders under `~/.gizmo/` and the cross-harness `~/.agents/`, never from Pi's
agent directory. Skills are installed globally, start disabled, and can be
overridden per workspace profile; see [`docs/resources.md`](docs/resources.md).

```sh
pnpm check
pnpm test
pnpm build
```
