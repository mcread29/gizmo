# Work log

## 2026-08-18 — Making a long agent run readable

A thread of 23 tool calls was mostly chrome: 23 avatars, 23 repeated
timestamps, and a bordered card around each single line of information.

- Consecutive same-role messages now share one header, and a finished,
  collapsed tool call is a compact row rather than a card. The same thread went
  from a block per message to four blocks and 16% less scroll height.
- Find in thread (Ctrl/⌘ F) over message text and tool arguments, with match
  counting per tool call rather than per message — a reply containing twenty
  matching calls is twenty results, not one.
- Unity console gained a text filter, copy, clear and timestamps, plus an error
  count badge on its tab so a new Editor error is visible without navigating.
- Structured tool results are highlighted as JSON, matching the code blocks
  beside them.
- Diffs mark the span that actually changed within a replaced line, but only
  when most of the line is genuinely shared; otherwise the line colour says it.
- Threads open pinned to their newest message, day separators break up long
  transcripts, the thread menu can collapse every tool call, an empty composer
  recalls the last prompt with the up arrow, and streaming text sits in a live
  region so it is announced as it is written.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
```

## 2026-08-18 — Tool calls name their arguments

Protocol version 8. Eight consecutive `unity_list_commands` cards all read
"Unity commands / Completed", which is unreadable: the arguments are the only
thing that distinguishes them.

- `ToolCallView` now carries the tool input. The live `tool.started` event
  already had it and the store was discarding it; resumed threads read it back
  out of the persisted transcript, accepting every key the format has used so
  older sessions keep their arguments.
- The card header shows a one-line summary of the arguments — a lone
  identifying value bare, several as `key=value` — and falls back to the status
  text only while a tool is running or when there is nothing to say. The
  expanded card lists every argument, and the inspector's Activity list uses
  the same summary.

## 2026-08-18 — Staying in control of a running agent

Followed the UI audit with the workflow gaps it exposed. Protocol version 7.

- Steering: the composer now sends `session.steer` while a response is
  streaming instead of disabling itself, so redirecting the agent no longer
  means aborting the run. Stop remains available alongside it.
- Changes: every `edit`/`write` in a thread is collected per file in a new
  inspector tab with cumulative counts, a wrapped diff, open-in-editor,
  copy-patch, and per-change revert. Revert is applied server-side by a
  reverse-patch applier that refuses when the file has moved on.
- Progress legibility: the streaming indicator names the running tool and
  counts elapsed time, the titlebar mirrors it, and a Jump to latest control
  appears once the transcript is scrolled away from the newest reply.
- Live Unity console: `project.watch` now polls the console alongside Editor
  status and pushes `project.console.appended`, rendered as a filterable tail.
- Smaller gaps: per-thread composer drafts that survive a restart and adopt
  text typed before the thread existed, diff hunks that link into the editor,
  an onboarding state for a machine with no registered projects, a configurable
  agent server address, an error taxonomy so the banner offers the action that
  fits the failure, and copy-transcript alongside a native save dialog.
- Window chrome: decorations are off and the app header is the drag region,
  with its own minimise, maximise and close controls.

Approvals were deliberately left off: the Changes tab is the review surface
instead, chosen over pausing the agent before every write.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
cargo check
```

## 2026-08-17 — UI audit remediation and frontend refactor

Acted on a critical audit of the Svelte frontend, and split the files that had
grown past the point of being readable:

- Added automatic reconnection with backoff to `AgentStore`, a manual retry in
  the sidebar, and session restoration so a dropped connection no longer leaves
  the app inert until it is relaunched.
- Made layout breakpoints a single source of truth in `lib/layout.ts`, published
  as `data-left-mode` / `data-right-mode`; the stylesheets no longer restate any
  width, and the first paint no longer flashes the desktop layout.
- Gave every focusable element a visible focus ring, marked undocked panels
  `inert`, and moved the toast live region so it is always mounted.
- Filled in the default dark theme's missing `--color-on-accent` and
  `--focus-ring`, added a type scale with an 11px floor, and moved the base font
  size to `rem` so OS text-size preferences scale the interface.
- Wired the toast queue into thread deletion and transcript export, moved the
  error banner out of the scrolling transcript and gave it dismiss and retry,
  added loading skeletons and empty states, and gave destructive confirmation a
  Cancel path that names what is about to be lost.
- Added syntax highlighting driven by the existing palette, a unified diff view
  with line numbers and position-based classification, thread search and
  recency grouping, message retry, and a desktop keyboard map.
- Split `App.svelte`, `AppDialogs`, `Conversation`, `ToolCallCard`,
  `UnityInspector`, and the two largest stylesheets into focused units, moving
  layout, thread actions, transcript export, and context-menu resolution into
  testable modules.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
```

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

## 2026-08-17 — Workspace threads and Pi model controls

Simplified thread and runtime configuration around the real Pi session:

- Removed the inspector command inventory because it represented only the most recent filtered `unity_list_commands` result, not the Editor's complete registry.
- Replaced the separate workspace dropdown and session button with one “New thread” action that creates a thread from the chosen registered Unity workspace.
- Added each thread's workspace name to the recent-thread list and made switching threads restore that workspace and Editor status.
- Added live model and thinking-level selectors to the composer, backed by Pi's authenticated model runtime, `setModel`, and `setThinkingLevel` APIs.
- Extended and versioned the browser protocol for model catalog and selection operations, with changes disabled while a response is streaming.
- Kept the model dropdown bounded for large provider catalogs and retained `data-ui`/state attributes for styling.

Live verification against the running agent returned the active
`openai-codex/gpt-5.6-sol` model, 20 available authenticated models, and all
seven supported thinking levels.

## 2026-08-17 — Resizable shell and growing composer

- Made the composer textarea grow with wrapped content up to 240 pixels before
  enabling its internal scrollbar.
- Made both desktop sidebars collapsible from their existing title-bar buttons.
- Added draggable resize edges with responsive width limits, arrow-key control,
  and double-click reset for the thread sidebar and Editor inspector.
- Preserved the existing overlay drawer behavior on narrower layouts.
- Added focused coverage for composer overflow, sidebar collapsing, and
  keyboard resizing.

## 2026-08-17 — Reliable tool output and app context menu

- Normalized live and restored Pi tool results so missing `details` falls back
  to text and genuinely empty results display an explicit label.
- Made failed Unity results render as errors when their structured output
  reports `ok: false`, even when Pi's outer tool call completed normally.
- Added a Bits UI context menu across the application shell with target-aware
  thread, message, tool-output, composer, Unity Editor, sidebar, theme, and
  settings actions.
- Bound rename, export, and delete to the right-clicked thread while preserving
  the currently active thread during background transcript reads.
- Added contextual copy, paste, and select-all actions for selected or editable
  content.
- Added focused tool-result and context-menu coverage.

## 2026-08-17 — Unity command authoring and reload loop

- Added `unity_wait_for_command`, bound to the session's selected project, to
  force script compilation and wait through Unity's domain reload.
- Made the loop tolerate temporary Pipeline disconnects, report compiler
  diagnostics, distinguish a missing registration from a failed compile, and
  return the newly registered command schema.
- Updated the Unity system prompt to inspect the project's real Pipeline API,
  author focused Editor-only commands, reload them, fix diagnostics, and invoke
  only the verified live schema.
- Added the reload tool to the harness-owned full-access policy and tool UI.
- Covered successful reloads, temporary disconnects, compiler failures,
  missing registration, and selected-project binding with focused tests.

Live harness verification confirmed that Pi exposes
`unity_wait_for_command` alongside the existing six tools. No connected Unity
project was recompiled or modified during this verification.

## 2026-08-17 — Live Editor lifecycle and command templates

- Replaced the browser's five-second status poll with a project subscription;
  the local server observes the Unity CLI, deduplicates status changes, and
  pushes them over the existing session event stream.
- Added compiling, domain-reload, command-verification, and failed lifecycle
  states to the Unity inspector using live reload-tool progress.
- Preserved structured compiler locations and made C# diagnostics link directly
  to their project files from both tool output and the inspector.
- Added `unity_command_template`, a reusable current Pipeline API starter that
  the agent adapts to a project's conventions before writing and reloading it.
- Versioned the protocol and added focused coverage for subscriptions,
  lifecycle derivation, diagnostic parsing, and template generation.

## 2026-08-17 — Compile, diagnose, and test loop

- Overrode Pi's built-in edit and write definitions with behavior-preserving
  tracked versions that mark Unity compilation inputs as pending.
- Added `unity_wait_for_compile` for ordinary script changes, sharing the same
  domain-reload handling and compiler diagnostics as command authoring.
- Added cursor-based `unity_console` collection so a compilation reports only
  the warnings and errors produced after it began.
- Added `unity_test`, backed by the connected Editor's registered `run_tests`
  command, with EditMode/PlayMode, name, assembly, and category filtering.
- Normalized test summaries, individual outcomes, stack traces, and source
  locations for durable transcript storage and clickable UI results.
- Extended the inspector with pending paths, console diagnostics, and the latest
  structured test report; the conversation renders the same persisted data.

## 2026-08-17 — Functional application settings

- Replaced the Pi/session information dialog with persisted application
  preferences for theme, composer behavior, output following, and panel
  visibility.
- Wired Enter-to-send and output-following preferences directly into the
  conversation, including the matching keyboard hint and Ctrl/Command+Enter
  fallback.
- Kept sidebar settings synchronized with the title bar and context-menu panel
  controls, and added one-click restoration of defaults.
- Added focused coverage for storage fallback, persistence, and live setting
  application.

## 2026-08-17 — Paired color schemes

- Added four schemes alongside the default: Vesper, Catppuccin, Rosé Pine, and
  Solarized, each with a light and dark variant.
- Used Latte/Mocha for Catppuccin and Dawn/Moon for Rosé Pine, and mapped every
  variant across surfaces, borders, statuses, focus rings, and accent contrast.
- Added a compact scheme dropdown and Light/Dark switch while preserving
  concrete variants locally and migrating the earlier Vesper value.

## 2026-08-18 — Gizmo identity

- Renamed the product from Unity Agent to Gizmo across the application,
  desktop metadata, generated Unity command templates, and documentation.
- Replaced the generic sparkle treatment with a geometric G and manipulation
  handle mark shared by the title bar, empty state, favicon, and desktop icons.
- Preserved existing storage, environment, bundle, and protocol identifiers so
  the rebrand does not discard sessions or settings.

## 2026-08-18 — Local-alpha roadmap correction

- Recorded that Unity CLI and Editor Pipeline already provide Gizmo's project
  connection and that command discovery, execution, authoring, reload, and
  verification have been validated.
- Removed the required Gizmo UPM package and `scene.validate` proof-of-concept
  from the core roadmap; any future shared command library must earn its place
  through repeated cross-project use and remain optional.
- Made sidecar isolation and recovery, clean-machine setup, cross-platform
  artifacts, signing, diagnostics, and packaged-build dogfooding the next
  release work.
- Reconciled the documented tool inventory and product-hardening backlog with
  the implemented application and its Changes-based mutation review model.
