# Handoff: workspace picker redesign

## Where this is

The "Open workspace" folder browser (`apps/app/src/lib/features/sessions/ProjectPickerDialog.svelte`)
was a one-level-at-a-time drill-down: no search, no way to jump to a distant
folder, dotfiles included. It's been reworked into a flat, fuzzy-searched,
keyboard-navigable list, with pinned root folders for quick jumps
(`~/repos`, `~/UnityProjects`, etc.).

What's done and working (typechecked, tests pass):
- `ProjectCatalog.search()` (`apps/agent-server/src/projects/project-catalog.ts`) —
  bounded recursive walk (depth 6, 200 results, skips `.dirs` and
  `node_modules`/`dist`/`build`/etc.), ranked exact > prefix > substring >
  subsequence match.
- `project.search` RPC wired through `packages/protocol/src/index.ts`,
  `websocket-server.ts`, `pi-agent-service.ts`, `WebSocketAgentClient.ts`,
  `FakeAgentClient.ts`, `AgentStore.svelte.ts`.
- `PinnedDirectoryStore` (`apps/app/src/lib/features/sessions/pinned-directories.svelte.ts`) —
  localStorage-backed pin list. A pin sets the search root rather than opening
  directly — pins are jump-off points, not workspaces themselves.
- Arrow keys move the highlighted result, Enter opens it, Backspace on an
  empty query pops out of a pinned scope.
- `browse()` (single-level listing, used by the desktop native-picker
  fallback path) now also hides dotfile directories.

## Open decision

genge compared this against t3code's own command palette (screenshots in
conversation) and the verdict was: still reads as a dialog wearing a
palette's clothes, not an actual palette. Concretely, t3code's version:

- has no dialog title/description/border chrome — it's a bare floating
  overlay over the dimmed app, not a `Dialog`-wrapped panel
- shows the current path as plain text above the list, not a boxed input
- highlights the active row subtly, not with a filled accent block
- has a persistent keybinding-hint footer baked into the UI
  (`↑↓ Navigate` · `Backspace Back` · `Esc Close` · `Enter Add`)

Question on the table: is it worth dropping the shared `Dialog` wrapper for
this flow and building a standalone overlay + keybinding-footer component, or
is the current in-dialog version good enough? Not yet decided — no
implementation work has started on this beyond what's described above. If
picking this back up, start by asking whether the answer is still "make it a
real command palette" before touching code.
