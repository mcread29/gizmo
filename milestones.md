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
- `unity_test`
- `unity_diagnose`

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

## Milestone 9 — Desktop packaging with Tauri

Add Tauri 2 to `apps/app` and package the agent server as a sidecar.

Implement:

- Sidecar startup and graceful shutdown.
- Random loopback port.
- Per-launch authentication token.
- Crash detection and restart UI.
- Narrow Tauri capabilities permitting only the named sidecar.

Acceptance:

- A packaged desktop build starts without a system Node installation.
- The WebView cannot launch arbitrary commands.
- Closing the application terminates the sidecar.
- A simulated sidecar crash is reported and can be recovered.
- macOS, Windows, and Linux build jobs produce appropriately named sidecars.

## Milestone 10 — Web deployment mode

Add a WebSocket transport targeting a hosted agent server.

Acceptance:

- The identical frontend build can run outside Tauri.
- Transport selection happens at application startup.
- Authentication is required for remote connections.
- Reconnection does not duplicate messages or tool results.
- The UI clearly distinguishes local Editor access from remote backend access.
- The web application never receives filesystem paths, credentials, or process permissions it does not need.

## Milestone 11 — Custom Unity Pipeline command package

Create the initial C# package with one useful high-level command, such as `scene.validate`.

Acceptance:

- Unity recompiles and registers the command.
- `unity list` discovers it without restarting the agent.
- `unity command scene.validate` returns structured data.
- The Pi agent invokes it successfully through `unity_command`.
- Compilation failure leaves the agent functional and reports that the command is temporarily unavailable.
- Any scene modifications support Undo and deliberately handle dirty/save state.

## Milestone 12 — Product hardening

Add:

- Model and authentication settings.
- Session history and deletion.
- Permission prompts for mutating Unity operations.
- Log redaction.
- Protocol compatibility handling.
- Release packaging and update strategy.

Acceptance:

- Read-only and mutating tools are visibly differentiated.
- Mutating commands can require user confirmation.
- Secrets never enter frontend logs, tool results, or session transcripts.
- Corrupt session data does not prevent the app from opening.
- A clean machine can install the desktop application and complete the primary Unity workflow.

The first meaningful release boundary is Milestone 9. Milestones 10–12 can follow once the local desktop workflow proves useful.