# Unity Agent

An open source agent built on Pi to interact with Unity through the Unity CLI.

## Development

Install dependencies and start both the Svelte app and local Pi agent server:

```sh
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The Vite development server proxies `/agent` to
the local WebSocket server on port `8787`.

Pi conversations are stored as JSONL under `~/.unity-agent/sessions`. The app
restores the last selected session and project on reconnect. Set
`UNITY_AGENT_DATA_DIR` to use a different application-data directory.

The backend uses Pi's selected model and authentication from
`~/.pi/agent/settings.json` and `~/.pi/agent/auth.json`. Run `pi` and use
`/login` or configure a provider API key before sending prompts.

Browser WebSockets are restricted to the local Vite origin by default. Set a
comma-separated `UNITY_AGENT_ORIGINS` value when intentionally serving the UI
from another origin.

The Unity tools are `unity_status`, `unity_list_commands`, `unity_command`, and
`unity_wait_for_command`. Command discovery returns the live Editor schemas,
supports text filtering, and is refreshed before every execution.
`unity_command` accepts validated named parameters or raw argument arrays for
unusual custom command syntax. After the agent authors an Editor-side command,
`unity_wait_for_command` forces compilation, waits through the domain reload,
reports compiler errors, and verifies the command's live registration.

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
seven active tools full access without approval prompts and disables ambient Pi
extensions.

```sh
pnpm check
pnpm test
pnpm build
```
