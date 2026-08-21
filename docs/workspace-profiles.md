# Workspace profiles

Gizmo's core is a general coding workbench. A workspace profile is the saved
agent configuration for a workspace: the prompt mode, extension roots, tool
policy, and profile-local skill overrides that should apply to new threads.

Extensions can provide profile defaults. When a workspace adds one of those
profiles, Gizmo copies the definition into `.gizmo/profiles.json`; later
edits are project-owned and do not mutate the bundled default. How extensions
themselves are structured, discovered, and loaded is described in
[extensions.md](extensions.md); this document is about the profile/workspace
UX built on top of them.

## Boundary

Core owns sessions, messages, coding tools, Git, files, models, layout, saved
profile files, and the extension lifecycle. An extension owns:

- workspace detection;
- a default profile definition for that extension;
- extension-specific system instructions;
- extension tools and confirmations;
- inspector UI, dialogs, and settings; and
- adapters to an external runtime such as the Unity Editor.

Workspaces are added explicitly. `projects.json` stores catalog metadata such as
path, title, and added time. Agent behavior is stored in
`.gizmo/profiles.json` inside the workspace. Detection supplies the initial
profile defaults, then Workspace settings lets users choose the active profile,
add detected extension profiles, and relocate each extension root for the active
profile.

Core coding and Git tools are always available and are not repeated by
extensions.

```text
workspace folder
      │
      ▼
extension registry ── detect/templates ──┬─ Unity: profile + tools + prompt
                                        └─ Svelte: profile + guidance + inspector
      │
      ├─ .gizmo/profiles.json
      ├─ active profile composes a Pi session, or Pi defaults for Default
      └─ contributed web UI
```

## UI workflow

An inspector receives an optional `onCollapse`. Render it in the panel header
with `PanelToggle` so the inspector can be closed from itself; it is absent
while the panel is collapsed, because the rail then owns that control.

The new-thread dialog accepts any folder, seeds profiles from detected
extensions, and stores the initial profile setup. The desktop build uses a
native folder picker; browser development accepts an absolute path. Stored
projects appear in the dialog on later launches. The server announces the
active extension IDs with the session-created event.

There is no current workspace. The sidebar lists every workspace as a row that
expands to its own threads, and the centre column shows either a thread or a
workspace. Opening a workspace (`#workspace/<path>`) replaces the thread column
while the sidebar and inspector stay put; it never opens or creates a thread.
A workspace screen has Overview, Profile and Settings tabs, so a workspace is
configured where it is shown rather than on a separate screen.

Threads do not exist outside a workspace: creating one requires a workspace, and
the row's `+` starts a thread in that workspace.

The Profile tab edits every part of a workspace's profiles: the list of
profiles on the left, and for the selected one its name, active state,
extension contributions and their roots, tool and system-prompt modes, and
profile-local skill overrides. A profile is shown as its departures from the
profile it starts at — the base is stated rather than chosen, every row that
differs from it is marked, and each marked row can be reverted to the base
individually or all at once. Profiles can be created, duplicated from
detected extension templates or from each other, and deleted; `default` stays
because every other profile falls back to it. Edits are local until Save, and
Revert restores the last saved state. Settings keeps what is not part of a
profile: extension settings and removing the workspace from Gizmo. Removal
does not touch project files or existing threads. The thread sidebar groups
sessions by project, sorted by project name, while keeping each project's
threads in most-recent-first order.

## Included extensions

### Unity

Detected by `ProjectSettings/`. It contributes Unity CLI/Pipeline tools, the
Editor lifecycle prompt, Editor inspector, Play Mode compile confirmation, and
Unity-hosted project extensions such as Console.

### Svelte

Detected when `package.json` declares `svelte` in dependencies or development
dependencies. It contributes Svelte-specific working guidance and a lightweight
changes/activity inspector. It intentionally has no custom tools yet; normal
coding and project scripts already cover the useful baseline. Unlike Unity, it
is built into core rather than loaded via `gizmo.extensions.json` — it has no
external dependency to load.

### Default profile

Every folder can run with the Default profile. This preserves Pi's normal
default coding-agent prompt and tool behavior, with only Gizmo-managed skills
added according to global and profile-local settings. Generic coding is core
behavior rather than a separate extension.

## Adding an extension

1. Add detection, a profile default, prompt, and tools in a server extension
   package, following the `GizmoServerExtension` contract in
   [extensions.md](extensions.md).
2. Add its web view and contributions following `GizmoWebExtension`.
3. Add its specifier to `gizmo.extensions.json`.
4. Add one focused detection/composition test and tests for any custom tools.
5. Keep protocol payloads generic. If a new contribution requires a host
   capability, design a reusable slot rather than adding a product-specific
   request to core.
