# Gizmo roadmap

## Current direction

Milestones 1–8 are complete, and the foundation of Milestone 9 is working: the
Tauri shell owns a compiled Bun sidecar, the UI talks to a real Pi session, and
Unity Pipeline commands have been discovered, invoked, authored, reloaded, and
verified against connected Editors.

The next release boundary is a distributable local alpha. Work should focus on
sidecar isolation and recovery, cross-platform packaging, clean-machine setup,
and failure diagnostics.

The project connection boundary is the Unity CLI and its Editor Pipeline.
Gizmo discovers registered commands at runtime and can author, compile, and
verify project-local Editor commands through the existing tool loop.

## Milestone 1 — Workspace and shared contracts

Scaffold the pnpm workspace:

```text
apps/app
apps/agent-server
packages/protocol
packages/unity-tools
packages/design
```

Acceptance:

- `pnpm install`, `pnpm check`, and `pnpm test` succeed from the repository root.
- The Svelte app imports a shared type from `packages/protocol`.
- The agent server imports the same protocol package.
- CI runs formatting, type checking, and focused tests.

## Milestone 2 — Svelte application shell

Create the Svelte 5 + Vite application with the initial layout:

```text
sidebar       sessions and Unity project
main          conversation
inspector     Editor state and tool activity
composer      prompt input and controls
```

Acceptance:

- The app builds to static assets.
- It runs in a normal browser.
- Keyboard navigation reaches every interactive region.
- Responsive layouts work at desktop and narrow widths.
- No Tauri APIs are imported directly by presentation components.

## Milestone 3 — Bits UI design system

Create app-owned wrappers around the required Bits UI primitives:

- Button
- Dialog
- Dropdown menu
- Select
- Tabs
- Tooltip
- Scroll area
- Toast

Use global CSS tokens and selectors such as:

```css
[data-ui="button"] {}
[data-ui="button"][data-variant="danger"] {}
[data-dialog-content][data-state="open"] {}
```

Acceptance:

- Components contain no utility-class styling.
- Light and dark themes work by changing a root data attribute.
- Hover, focus, disabled, open, and selected states are visibly distinct.
- A component gallery displays every supported state.
- Automated accessibility checks report no critical violations.

## Milestone 4 — Transport-independent agent client

Define the versioned protocol and frontend `AgentClient` interface:

```ts
interface AgentClient {
  connect(): Promise<void>;
  createSession(options: SessionOptions): Promise<string>;
  prompt(sessionId: string, text: string): Promise<void>;
  steer(sessionId: string, text: string): Promise<void>;
  abort(sessionId: string): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
}
```

Acceptance:

- All messages are validated at runtime.
- Unknown message types and incompatible protocol versions fail clearly.
- A fake client can drive the entire UI without Pi or Unity installed.
- Tests cover connection loss, malformed messages, text streaming, tool events, and aborts.

## Milestone 5 — Pi agent server

Create the Node/TypeScript backend using `@earendil-works/pi-coding-agent`.

Implement:

- Agent session creation and disposal.
- Prompt, steering, follow-up, and abort operations.
- Pi event translation into the shared protocol.
- Persistent and in-memory session modes.
- Graceful shutdown.

Acceptance:

- A scripted fake model produces streamed text in the frontend.
- Two sessions remain isolated.
- Aborting stops an active response.
- Restarting the server can reopen a persisted session.
- Backend errors become structured protocol errors rather than terminating the process.

## Milestone 6 — Unity CLI execution layer

Implement a single safe Unity process runner.

It should:

- Execute `unity` directly with argument arrays.
- Request JSON or NDJSON explicitly.
- Capture stdout and stderr separately.
- Preserve exit codes.
- Support cancellation and timeouts.
- Resolve a specific project or connected Editor.

Acceptance:

- Tests cover success, malformed JSON, timeout, cancellation, stderr, and nonzero exit codes.
- No shell-string interpolation is used.
- The runner detects and reports an unavailable or incompatible Unity CLI.
- A real smoke test successfully runs `unity --version` and `unity status --format json`.

## Milestone 7 — Initial Pi Unity tools

Add:

- `unity_status`
- `unity_list_commands`
- `unity_command`
- `unity_console`
- `unity_wait_for_compile`
- `unity_wait_for_command`
- `unity_test`
- `unity_command_template`

Acceptance:

- Each tool has a constrained TypeBox input schema.
- Tool results use one consistent structured result shape.
- Unknown projects, disconnected Editors, missing Pipeline installations, and failed commands produce actionable errors.
- Unit tests use a fake Unity runner.
- An integration test invokes a harmless command against a connected Editor.
- The agent cannot pass arbitrary executables or raw shell commands through these tools.

## Milestone 8 — First end-to-end workflow

Connect the UI, Pi server, and Unity tools.

Acceptance:

1. The user selects a Unity project.
2. The app displays the connected Editor’s status.
3. The user sends a prompt.
4. Assistant text streams into the conversation.
5. Unity tool calls appear with running, succeeded, or failed state.
6. A tool result returns to the model.
7. The model produces a final response.
8. The user can abort at any point without leaving the session stuck.

Automate this path with fake Pi and Unity implementations; retain one manual real-Editor verification.

## Milestone 9 — Desktop local-alpha hardening

The Tauri shell, compiled Bun sidecar, narrow frontend capability, graceful
shutdown, and target-aware sidecar build already exist. Finish the process
boundary required for a dependable local alpha.

Implement:

- Sidecar startup and graceful shutdown.
- Random loopback port.
- Per-launch authentication token.
- Crash detection, automatic recovery, and explicit restart UI.
- Narrow Tauri capabilities permitting only the named sidecar.
- Actionable startup and connection diagnostics.

Acceptance:

- A packaged desktop build starts without a system Node installation.
- The WebView cannot launch arbitrary commands.
- Closing the application terminates the sidecar.
- A simulated sidecar crash is reported and can be recovered.
- Parallel launches receive isolated ports and authentication tokens.

## Milestone 10 — Local-alpha distribution

Turn the hardened desktop application into an installable release rather than
another development build.

Implement:

- macOS, Windows, and Linux CI build artifacts with correctly named sidecars.
- Signing and notarization where the target platform requires them.
- First-run checks for Pi authentication, Unity CLI availability, and Editor
  connectivity.
- A versioning, release-notes, and update strategy.
- Packaged-build dogfooding against representative existing projects and
  commands.

Acceptance:

- A clean machine can install Gizmo without Node and complete the primary Unity
  workflow.
- Startup failures identify the missing dependency or failed process and offer
  a recovery action.
- Sessions survive normal application and sidecar restarts.
- Release artifacts are reproducible and traceable to a source revision.

## Milestone 11 — Web deployment mode (deferred)

Add a WebSocket transport targeting a hosted agent server.

Acceptance:

- The identical frontend build can run outside Tauri.
- Transport selection happens at application startup.
- Authentication is required for remote connections.
- Reconnection does not duplicate messages or tool results.
- The UI clearly distinguishes local Editor access from remote backend access.
- The web application never receives filesystem paths, credentials, or process permissions it does not need.

## Milestone 12 — Product hardening

Add:

- Secret and log redaction across the backend, protocol, and persisted
  transcripts.
- Corrupt-session isolation and recovery.
- An explicit mutation policy integrated with the existing Changes review
  surface.
- Protocol and sidecar compatibility gates.
- Support diagnostics that can be exported without credentials or project
  contents.

Acceptance:

- Read-only and mutating tools are visibly differentiated.
- Mutation policy is clear and can be tightened without changing tool
  implementations.
- Secrets never enter frontend logs, tool results, or session transcripts.
- Corrupt session data does not prevent the app from opening.
- Incompatible frontend, backend, or protocol versions fail with a recovery
  path rather than undefined behavior.

Milestones 9 and 10 form the local-alpha release boundary. Web deployment and
broader hardening follow only after the packaged local workflow proves useful.
