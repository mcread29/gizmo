# Work log

## 2026-08-17 — Milestones 1–3

Established the project foundation and initial interface:

- Created a pnpm monorepo with the Svelte app, agent server, shared protocol, Unity tools, and design packages.
- Added root formatting, type-checking, testing, build scripts, and CI verification.
- Built the responsive three-pane agent workspace with session navigation, conversation and tool-call states, a composer, and Unity Editor inspector.
- Added app-owned wrappers for Bits UI buttons, dialogs, menus, selects, tabs, tooltips, and scroll areas, plus an accessible toast component.
- Implemented global data-attribute styling, shared design tokens, light and dark themes, responsive drawers, and a component gallery.
- Added structural and accessibility tests and reviewed the UI at desktop and mobile viewport sizes.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
pnpm peers check
```

The next planned milestone is the transport-independent agent client and versioned frontend/backend protocol.

## 2026-08-17 — Milestone 4 and Pi service foundation

Completed the transport-independent client foundation and began Milestone 5:

- Added a versioned TypeBox protocol for session requests, lifecycle events, streamed messages, tool activity, and structured errors.
- Added runtime validation that rejects unknown messages and incompatible protocol versions.
- Implemented the frontend `AgentClient` interface, a deterministic fake client, and a reactive Svelte agent store.
- Replaced the hard-coded conversation with live prompt, streaming, tool-call, error, and abort states.
- Added session-isolation, malformed-event, streaming, abort, and UI integration tests.
- Installed the Pi coding-agent SDK and added an injectable `PiAgentService` around `createAgentSession()`.
- Added translation from Pi SDK events into the shared application protocol without requiring credentials in tests.

The Pi service is currently an in-process backend boundary. Network and Tauri sidecar transports remain the next implementation slice.

## 2026-08-17 — Live Pi WebSocket vertical slice

Connected the application UI to the actual Pi SDK:

- Added correlated protocol responses for successful and failed client requests.
- Added a local WebSocket server with one isolated `PiAgentService` per connection and graceful disposal.
- Added the production browser `WebSocketAgentClient` and Vite development proxy.
- Changed the root development command to start the frontend and agent server together.
- Replaced the placeholder model picker with the provider, model, and thinking level selected by Pi.
- Added structured transport errors and visible handling for an unexpected server disconnect.
- Restricted browser WebSocket access to explicitly allowed local origins.
- Added focused protocol, WebSocket server, browser client, and UI tests.
- Verified a real prompt through the Vite `/agent` route using the locally stored OpenAI Codex OAuth login and `gpt-5.6-sol`.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
```

The development stack runs at `http://localhost:5173` with the agent server on
`ws://127.0.0.1:8787/agent`.

## 2026-08-17 — First Unity CLI tool

Completed the first Unity-aware vertical slice:

- Confirmed the installed experimental Unity CLI `1.0.0-beta.5` syntax from its live help.
- Added a shell-free Unity process runner with separate stdout and stderr capture, exact exit codes, cancellation, timeouts, bounded output, and forced termination fallback.
- Added structured parsing for `unity status`, including its exit-code-6 no-Editor response.
- Added and registered the constrained `unity_status` Pi tool.
- Preserved structured tool details through the server protocol for UI consumers.
- Replaced placeholder Editor status data with the latest observed `unity_status` result.
- Added focused process, parsing, tool, translation, and UI coverage.
- Verified a real Pi turn called `unity_status`, ran the installed Unity CLI, reported the disconnected state, and returned a final assistant response.

The machine currently has no connected Unity Editor with the Pipeline package,
so the live result is `STATUS_NO_INSTANCES`. No Unity installation, project, or
authentication state was changed.

## 2026-08-17 — Unity command discovery

Added safe discovery for custom Unity Pipeline commands:

- Added reusable parsing for the Unity CLI's common JSON response envelope.
- Added the read-only `unity_list_commands` tool with an optional constrained project path.
- Registered command discovery alongside `unity_status` in every Pi session.
- Added real discovered-command state to the Editor inspector.
- Verified Pi selected and invoked `unity_list_commands` through the web transport.

The live CLI returned exit code `6` because no reachable Pipeline server is
currently available. Arbitrary `unity_command` execution remains intentionally
unregistered until the app has a user-confirmation boundary for potentially
mutating Editor commands.
