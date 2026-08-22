# Work log

## 2026-08-21 — The scope chip was never "one text input"; removed it

- genge called out that the pill-plus-separate-placeholder-field from the
  last pass wasn't actually "one text input" — it was two things dressed up
  to look like one. Rebuilt `CommandPalette.svelte`'s workspace mode as a
  real address bar instead: a single `location` string *is* the input's
  value, full stop. No chip, no separate root state exposed as UI.
- Typed text is parsed by `splitLocation()`: if it extends the last resolved
  directory, everything after the last separator is a filter on that
  directory's children; if it doesn't (a pasted or freshly typed absolute
  path), the text up to its last separator becomes the new directory to
  browse. This is the same job a shell does when you tab-complete.
- Tab now fills `location` with the highlighted result's full path (plus a
  trailing separator) and the list repopulates with its children — same
  behavior as before, but now it's visibly the actual input text instead of
  a separate chip.
- Dropped the special "Backspace clears the scope" step entirely — deleting
  characters is just normal text editing now. Backspace on a fully empty
  field still pops back to the command list, since there's nothing left to
  delete there.
- Found and fixed a self-inflicted bug while rebuilding this: an earlier
  version auto-filled `location` with the resolved home path from inside the
  same effect that reacts to `location` changing, which raced against
  bits-ui's own initial-selection timing and intermittently left Tab
  operating on a stale/empty selection. Removed the auto-fill; the field
  now only changes when the user types, clicks a pin, or presses Tab.

## 2026-08-21 — Tab drills into a folder; fixed a corner-radius mismatch

- Added Tab as a drill-in key in `CommandPalette.svelte`'s workspace mode:
  it scopes into the currently highlighted result (same as clicking a pin),
  clearing the query and repopulating the list with that folder's
  subfolders — Enter still commits ("Add"), Tab now browses deeper. Needed
  `Command.Root`'s `value` bound so the palette knows which item is
  currently highlighted.
- The scope chip now shows the highlighted folder's *full* path rather than
  just its last segment, so drilling in visibly confirms where you are —
  which was really the point of the request ("tab should fill with the
  path"). Truncates from the left (`direction: rtl` trick) when too long,
  since the meaningful/distinguishing part of a path is usually the tail.
- Fixed the "inconsistent rounded corners" complaint: the plain `<input>`
  inside the palette had no `border-radius`, so its global `:focus-visible`
  ring rendered as a sharp-cornered box sitting inside an otherwise fully
  rounded panel — jarring next to `--radius-lg` (panel), `--radius-md`
  (result rows), `--radius-sm` (footer kbd). Gave it `--radius-md` to match
  the row highlight it sits above.
- Added a test asserting Tab scopes into the highlighted folder and shows
  its full path with the query cleared.

## 2026-08-21 — Workspace search was quietly searching all of $HOME

- The unscoped folder search (no pin picked) defaulted its root to
  `homedir()` and then recursed up to 4-6 levels deep — so typing anything
  before scoping into a pin walked the user's entire home directory,
  surfacing noise from `~/snap/chromium/...` caches and deeply nested Unity
  asset folders. Pins were supposed to be *how* you opt into that recursive
  search; instead it ran unconditionally. Fixed in
  `ProjectCatalog.search()` (`apps/agent-server/src/projects/project-catalog.ts`):
  recursion now only happens when `root` is explicitly passed (i.e. the user
  scoped into a pin) — unscoped queries just filter home's immediate
  children, same as an empty query already did.
- Tightened `matchScore` to require an actual substring match, dropping the
  subsequence fallback — it was scoring "repos" as a match against "Crash
  Reports" (the letters r-e-p-o-s do appear in that order), which is exactly
  the kind of nonsense result reported.
- Fixed a CSS overflow bug in the same complaint: `[data-ui='palette-panel']`
  had no `overflow: hidden` and `[data-ui='palette-result']` had no
  `min-width: 0`, so a long unscoped path could visibly spill out past the
  dialog's rounded corner instead of eliding.
- Added `ProjectCatalog` tests for both the scoped-recursion behavior and
  the substring-only matching.

## 2026-08-21 — Unity and Git use the new command-palette surface

- Unity (`packages/unity/src/web/domain-plugin.ts`): "Open Unity Editor"
  (hidden once an editor instance is already connected, via
  `projectStatus.instances[0]`) and "Refresh Unity project status", gated on
  `activeDomains.includes('unity')` plus a selected project. Both just call
  the same `openSelectedProject()`/`refreshProjectStatus()` methods the
  workspace view's `open()`/`refresh()` already use.
- Git (`packages/git/src/web/index.ts`): "Commit all changes" and "Refresh
  Git status", gated on a selected project only — matching the Git inspector
  tab, which is always shown regardless of domain. "Commit all changes"
  generates the AI commit message and commits immediately rather than
  reopening the panel's review dialog; this skips the manual-edit step the
  in-panel button offers, which is a deliberate tradeoff for a one-shot
  palette command, worth revisiting if it surprises anyone.
- Left out for now: "Refresh console" / "Clear console" for Unity. Those
  live on the *activated* per-project `ConsoleExtensionRuntime`
  (`console-extension.svelte.ts`), not the static extension definition, and
  `CommandPalette` only reads static `commands()` today — wiring those in
  would mean adding `commands` to `WebExtensionRuntime` too and threading the
  currently-active project runtimes into the palette (right now only
  `WorkspaceInspector` holds them). Flagging as a follow-up rather than
  doing it inline.

## 2026-08-21 — Extensions can contribute palette commands

- Added `commands?(context): CommandContribution[]` to `GizmoWebExtension`
  (`apps/app/src/lib/extensions/types.ts`), mirroring the existing
  `inspectorTabs` contribution point: static (no per-project `activate()`
  needed), context is just `{ store, projectPath }`. A contribution is
  `{ id, label, keywords?, icon?, run() }`.
- `CommandPalette.svelte` aggregates `webExtensions().flatMap(ext =>
  ext.commands?.(...) ?? [])` into an "Extensions" group in the root command
  list, same pattern `WorkspaceInspector.svelte` already uses for tabs.
  Commands without an icon fall back to a generic `Puzzle` glyph.
- Added `commands` to the runtime bundle validator's `keep()` list
  (`load-web-extension.ts`) so untrusted runtime-loaded extensions get the
  same drop-if-malformed treatment other fields get, rather than being
  silently ignored (which is what currently happens to `inspectorTabs` there
  — a pre-existing gap, left alone since it's not what was asked for here).
- No bundled extension (unity/svelte/git/activity) contributes a command
  yet — this is the mechanism, not new commands.

## 2026-08-21 — A real global command palette, not just a folder search

- What genge actually meant by "a real command palette" was a global
  Cmd/Ctrl+K launcher with "Open workspace" as one command among others, not
  a nicer-looking dialog scoped to one flow. Rebuilt on bits-ui's `Command`
  primitive (the same one cmdk-style palettes use), replacing the hand-rolled
  fuzzy list, arrow-key handling, and selection state from earlier today —
  the library now owns keyboard nav, selection, and (for the root command
  list) the fuzzy filtering/scoring.
- `ProjectPickerDialog.svelte` is gone; `CommandPalette.svelte`
  (`apps/app/src/lib/features/sessions/`) replaces it with two modes: `root`
  (New thread, Open settings, Search threads, Open workspace…) and
  `workspace` (the folder search, entered either directly or via the "Open
  workspace" command). `SessionActions.commandPaletteOpen` /
  `commandPaletteMode` replace the old `projectPickerOpen` boolean.
- Cmd/Ctrl+K now opens the palette; the sidebar's own thread-search shortcut
  moved to Cmd/Ctrl+Shift+K to make room (updated in `shortcuts.ts` and the
  About page's shortcut list).
- Fixed a stale `App.test.ts` assertion for this dialog (it referenced markup
  removed by the fuzzy-search redesign earlier today and had been failing
  since; not caught before because the suite wasn't run after that commit).

## 2026-08-21 — Workspace picker becomes a real command palette

- Dropped the shared `Dialog` wrapper (title, description, bordered card
  header) for this flow in favor of a bare floating overlay built directly on
  bits-ui's `Dialog.Root`/`Portal`/`Overlay`/`Content` primitives — title and
  description are now visually hidden (kept for a11y) rather than rendered
  chrome.
- Added a persistent keybinding footer (`↑↓ Navigate`, `Backspace Back` when
  scoped to a pin, `Esc Close`, `Enter Add`) so the interactions are visible
  instead of assumed.
- This resolves the open question from the entry below: once compared
  side-by-side with t3code's own palette, the dialog framing (border, title
  bar, block-highlighted rows) was the thing making it "feel bad" — the search
  logic underneath was already fine.

## 2026-08-21 — Workspace picker: fuzzy search, still mid-redesign

- Replaced the "Open workspace" folder browser's one-level-at-a-time drill-down
  with a flat, fuzzy-searched list: typing filters folder names recursively
  under a root (default `~`), skipping dotfiles and common build/dependency
  directories (`node_modules`, `dist`, `.git`, etc.), ranked exact match >
  prefix > substring > subsequence, capped at 200 results.
- Added `ProjectCatalog.search()` server-side and a `project.search` RPC to
  back it; `browse()` (single-level listing) stays for the desktop-picker
  fallback path and now also hides dotfile directories.
- Added pinned folders (`~/repos`, `~/UnityProjects`, etc.), stored in
  `localStorage` via `PinnedDirectoryStore`. A pin sets the search root rather
  than opening directly, since pins are meant as jump-off points, not
  workspaces themselves.
- Keyboard-driven: arrow keys move the highlighted result, Enter opens it.
- This was iterated against t3code's command palette as a reference and still
  reads as a dialog wearing a palette's clothes rather than an actual
  palette — see `HANDOFF-workspace-picker.md` for the open decision on whether
  to drop the `Dialog` chrome for a bare floating overlay instead.

## 2026-08-20 — A workspace profile is edited where it lives

- Made the workspace screen's tabs a column ending in one scrolling panel: the
  panel had sized itself to its content, so a long tab ran off the bottom of
  the window with no way to scroll it.

- Gave the workspace screen a Profile tab: the whole profile is editable there,
  not just the active profile's extension checkboxes. Name, base, active state,
  extensions and roots, tool and prompt modes, and skill overrides all belong to
  the profile being edited, and profiles can be created, duplicated from the
  list, and deleted.
- Made editing explicit rather than half-live: changes stay local until Save,
  Revert restores the last saved state, and the header states when there is
  unsaved work. Skill switches previously wrote through immediately while every
  other control waited for Save.
- Read a profile as its departures from the profile it starts at: the base is
  stated instead of being another select, rows that differ from it are marked,
  and each one reverts from its own menu (or all at once). Nothing else said
  which settings were the profile's own and which came from the base.
- Left Settings with what is not part of a profile — domain settings and
  removal — plus a link to the Profile tab, so one screen no longer mixed
  workspace removal with per-profile skill toggles.

## 2026-08-20 — Workspace profiles own agent configuration

- Replaced workspace integrations as the user-facing configuration model with
  project-owned profiles stored in `.gizmo/profiles.json`.
- Kept bundled Unity and Svelte domains as extension contribution boundaries:
  they now provide profile defaults, prompt fragments, tools, and UI, while the
  copied workspace profile is the editable source of truth.
- Left `projects.json` as catalog metadata and compatibility state only. The
  active profile's extension roots are still exposed as `integrations` to older
  session and UI code while the migration continues.
- Moved skill overrides onto the active profile, so the Default profile can
  remain Pi-default plus Gizmo-managed global/profile skill state.
- Changed Workspace settings to select/add profiles, edit active profile
  extension roots, and use the shared select component for the profile picker.

## 2026-08-19 — Project extension boundary

Replaced the Console-specific project integration with a generic extension host
and bumped the protocol to version 13.

- Unity exposes versioned descriptors through `gizmo_extensions` and opaque,
  declared operations through `gizmo_extension_invoke`.
- The agent server discovers those entrypoints before invocation, validates the
  extension and operation, enforces declared confirmation requirements, and
  otherwise leaves payloads uninterpreted.
- The app keeps project-scoped extension descriptors in the agent store and
  renders generic inspector contributions from registered web extensions.
- The Console now owns its payload validation, polling, state, badge, panel,
  tests, and styles under `lib/extensions/console`; core contains no
  Console-extension branches or state.

The Cronkis Extras package provides the first implementation of the boundary as
`com.gizmo.extras.console`.

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
- Centered the roadmap on the established Unity CLI and Pipeline command loop.
- Made sidecar isolation and recovery, clean-machine setup, cross-platform
  artifacts, signing, diagnostics, and packaged-build dogfooding the next
  release work.
- Reconciled the documented tool inventory and product-hardening backlog with
  the implemented application and its Changes-based mutation review model.

## 2026-08-20 — Skill and resource management

- Added a resource catalog that discovers skills, `AGENTS.md` files, prompt
  templates, and Pi extensions for the global agent directory and the open
  workspace, listing extensions from disk so none of their code runs.
- Made skills installed globally by default but disabled until enabled, with
  per-workspace overrides in either direction and a remembered uninstall so
  discovery does not reinstate a removed skill.
- Gave sessions their skills explicitly through `additionalSkillPaths` instead
  of letting Pi rediscover them, so a disabled skill cannot reach a session.
- Added the skills section to Settings, per-workspace toggles to Workspace
  settings, and `docs/resources.md`.

## 2026-08-20 — Settings rework

- Replaced the single scrolling Settings page with a two-pane screen whose left
  nav groups pages by scope: device preferences, agent configuration, and About.
  Every page states who it affects, which the old flat list left implicit.
- Made Settings pages addressable as `#settings/<page>` and gave Workspace
  settings its own screen at `#workspace-settings`, replacing the dialog.
- Merged Composer and Reasoning into Chat, added a System appearance option that
  tracks the operating system, moved the keyboard reference and a now-confirmed
  Restore defaults into About, and dropped the panel toggles that duplicated the
  title bar and its shortcuts.
- Reworked skill rows: two-line descriptions with expansion, install and remove
  behind a row menu, search and an on/off filter, and grouping by scope.

## 2026-08-20 — Panel controls move into the panels

- Gave each docked panel its own collapse control in its header and left a
  40px rail behind when collapsed, so the control that reopens a panel stays
  where the panel was instead of living in the title bar.
- Kept title-bar toggles only for floating panels, which have no rail, and
  hid the theme toggle along with the rest of the workspace controls while a
  full screen covers the workspace.
- Extended the domain inspector contract with an optional `onCollapse` that
  the panel renders in its own header.

## 2026-08-20 — Gizmo-owned resource folders

- Moved skills, prompt templates, and `AGENTS.md` to `~/.gizmo/` and the
  workspace's `.gizmo/`, plus the cross-harness `~/.agents/` locations, and
  stopped reading anything Pi would load from its own agent directory.
- Renamed the data directory to `~/.gizmo/`, so sessions, workspaces, and
  resource state sit beside the resources they describe.
- Kept Pi's agent directory for credentials and model configuration, and copy
  its skills and `AGENTS.md` across once so existing setups keep working.
- Dropped the Pi extensions list: sessions run with extensions disabled, so
  showing them implied an influence they do not have.

## 2026-08-20 — One Agent settings page

- Collapsed Skills and Resources into a single Agent page and dropped the
  now-redundant group heading above it in the settings nav.
- Ordered the page by how directly each resource applies: `AGENTS.md` first
  because it reaches every session, then skills, then prompts.
- Kept the old `#settings/skills` and `#settings/resources` fragments working
  by resolving both to the Agent page.
- Fixed an intermittent app test-run failure: bits-ui restores the body scroll
  lock 24ms after a dialog unmounts, which threw against a torn-down jsdom when
  a file ended first. Tests now wait out that timer when a lock is outstanding.

## 2026-08-20 — Workspaces are places

- Made selecting a workspace open its overview instead of resolving to a
  thread. Browsing workspaces no longer creates empty threads, and switching
  workspace and opening a thread are now separate acts.
- Moved the workspace overview out of the empty-thread state onto its own
  `#overview` route beside the sidebar, so a workspace's threads, profiles, and
  settings stay reachable while a thread is open.
- Listed every workspace's threads in one grouped sidebar list with the current
  workspace first, which also makes cross-workspace search find something.
- Split the sidebar switcher: the workspace name opens the overview, the
  chevron only switches, and the admin actions it used to carry live on the
  overview and in Settings.

## 2026-08-20 — Workspaces without a current one

- Removed the ambient current workspace. The sidebar lists every workspace as a
  row that expands to its threads, with the workspace's own new-thread and
  settings buttons on the row, replacing the switcher dropdown.
- Made the workspace screen replace the thread column instead of covering the
  window: the previous version rendered inside the shell's inert overlay, so
  its buttons could not be clicked and the sidebar disappeared.
- Merged Workspace settings into that screen as a tab, so a workspace is
  configured where it is shown, and dropped the separate route.
- Required a workspace to create a thread, so a thread can no longer exist
  outside one.

## 2026-08-20 — One name per component

- Renamed the sidebar's workspace button to `workspace-entry`: it had reused
  `workspace-open`, already the workspace picker's card, so import order alone
  decided which rules applied and the sidebar's had no effect.
- Moved the Settings controls out of `dialogs.css`, where they had been left
  when Settings stopped being a dialog, and deleted the rules for markup that
  no longer exists.

## 2026-08-20 — Transitions land in one frame

- Navigate first and fetch behind: opening a workspace routes immediately
  instead of awaiting its status and Git, which was why the header, sidebar and
  inspector arrived one after another.
- Gave the store one `#enterWorkspace` step that flips every workspace-derived
  value synchronously, used by both workspace selection and thread switching,
  so a thread in another workspace moves the sidebar and inspector at once
  rather than after its transcript resolves.
- Replaced claims made before data arrives with skeletons: the Changes panel no
  longer reports a clean working tree while Git is still loading, the workspace
  overview skeletons its source-control card, and a switching transcript shows
  placeholder blocks instead of reading as an empty thread.
