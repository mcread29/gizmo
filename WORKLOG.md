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

## 2026-08-17 — Real project and session workspace

Replaced the remaining project and session fixtures with working application state:

- Added protocol operations and a backend service for listing Hub-registered projects, checking the selected project's Editor status, and opening its Editor.
- Restricted status and open operations to exact paths returned by the Unity project registry.
- Added a status-before-open check so an already-open project never launches a second Editor.
- Connected the project picker to the live Unity CLI registry and refresh the selected Editor status every five seconds.
- Rooted each new Pi session in the selected project and added in-memory session creation, switching, first-prompt titles, rename, transcript export, and deletion.
- Disposed deleted Pi sessions on the backend instead of leaving hidden agent sessions alive.
- Added a functional settings view showing the provider, model, thinking level, and local Pi authentication boundary reported by the real session.
- Added focused coverage for normalized project data, exact-path validation, no-duplicate opening, disconnected opening UI, project transport parsing, and session lifecycle.

Live read-only verification found eight registered Unity projects. The first project was reported as connected through the WebSocket project API. No Editor was opened during verification.

## 2026-08-17 — Explicit full-access tool policy

Made the custom harness authoritative over Pi's active capabilities:

- Replaced Pi's ambient default tools with the explicit `read`, `edit`, `write`, `unity_status`, `unity_list_commands`, and `unity_command` allowlist.
- Disabled installed extension loading so extension tools and hooks are not introduced implicitly.
- Bound all Unity tools to the selected session project rather than accepting a model-supplied project path.
- Added unrestricted execution of commands registered by the connected Editor, with structured arguments, cancellation, timeouts, output limits, and no approval prompt.
- Re-checks the Editor's live command registry before every execution and rejects unknown command names without spawning a second command process.
- Report Pi's actual active tools in the session event and show the effective policy in Settings.

Live verification confirmed that Pi activated exactly the six allowlisted tools. The `unity_command` execution path successfully invoked the read-only registered `editor_status` command against the selected project. No project or Editor state was changed during verification.

## 2026-08-17 — Durable sessions, live schemas, and Tauri desktop

Completed the recommended persistence and desktop foundation:

- Replaced `SessionManager.inMemory()` with app-isolated, disk-backed Pi JSONL sessions under `~/.unity-agent/sessions` (or `UNITY_AGENT_DATA_DIR`).
- Added backend session list, resume, rename, delete, transcript hydration, and last-session restoration operations.
- Restored the selected project from the resumed session and removed the browser-only transcript/session source of truth.
- Added restart recovery and cross-project isolation coverage using temporary data directories.
- Normalized the live Unity command catalog, added text filtering and result limits, and exposed full parameter schemas to Pi.
- Added schema-aware named argument construction with required/unknown parameter validation while retaining raw arguments for unusual command syntaxes.
- Kept command discovery hot by reading the Editor registry for discovery and again immediately before execution.
- Added a Tauri 2 desktop shell with a narrow frontend capability, CSP, generated app icons, and a Rust-owned agent sidecar lifecycle.
- Added a target-aware Bun compile step so packaged desktop builds include the agent server and do not require Node on the destination machine.
- Verified the compiled sidecar could create a real Pi session with the exact six-tool policy and built a Linux `.deb` package successfully.

Focused verification covered 55 TypeScript tests at this point, plus Cargo check, a compiled-sidecar protocol smoke test, and the production desktop build.

## 2026-08-17 — Unity-specific system prompt

Made the harness own its system prompt while retaining Pi's prompt structure:

- Added a readable snapshot of Pi 0.84.2's generated default prompt for the current tool policy.
- Added a Unity-focused runtime prompt covering project files, live Editor state, command discovery, command execution, and authoring missing Pipeline commands.
- Wired the prompt through `DefaultResourceLoader.systemPromptOverride` without disabling Pi's runtime project context, appended instructions, skills, or working-directory suffix.
- Added focused coverage ensuring every active harness tool remains documented in the prompt.

Agent-server tests and type checking pass with the override enabled.

## 2026-08-17 — Conversation UI rollout

Reworked the frontend around the real agent conversation without changing its
transport or store ownership:

- Reduced the root application component to composition and lifecycle state, with focused shell, session sidebar, conversation, message, tool card, inspector, and dialog components.
- Split application styling into shell, conversation, Unity, and development-gallery feature sheets while retaining Bits UI, shared tokens, and `data-ui` selectors.
- Made the component gallery development-only so it is excluded from the product build.
- Added sanitized GitHub-flavored Markdown with headings, lists, tables, links, inline code, fenced code blocks, and per-block copy controls.
- Added response and tool-output copy actions, a streaming cursor, and bottom-following behavior that stops when the user scrolls away from the latest output.
- Replaced one-line JSON tool results with collapsed summaries, structured output, readable file diffs, Unity Editor status cards, and registered-command chips.
- Added focused security, Markdown, diff, tool presentation, and full application-flow coverage.

The app passes Svelte diagnostics with no warnings and all frontend tests.
