# Workspace profiles and domains

Gizmo's core is a general coding workbench. A workspace profile is the saved
agent configuration for a workspace: the prompt mode, extension roots, tool
policy, and profile-local skill overrides that should apply to new threads.
Domains are the lower-level capabilities that bundled extensions contribute,
such as Unity tools or Svelte guidance.

Bundled extensions can provide profile defaults. When a workspace adds one of
those profiles, Gizmo copies the definition into `.gizmo/profiles.json`; later
edits are project-owned and do not mutate the bundled default. Project-side
Unity extensions are separate and are described in [extensions.md](extensions.md).

## Boundary

Core owns sessions, messages, coding tools, Git, files, models, layout, saved
profile files, and the extension lifecycle. A domain owns:

- workspace detection;
- a default profile definition for that extension;
- domain-specific system instructions;
- domain tools and confirmations;
- inspector UI, dialogs, and settings; and
- adapters to an external runtime such as the Unity Editor.

Workspaces are added explicitly. `projects.json` stores catalog metadata such as
path, title, and added time. Agent behavior is stored in
`.gizmo/profiles.json` inside the workspace. Detection supplies the initial
profile defaults, then Workspace settings lets users choose the active profile,
add detected extension profiles, and relocate each extension root for the active
profile.

Core coding and Git tools are always available and are not repeated by domains.

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

## Server contract

Server domains implement `WorkspaceDomain` in
`apps/agent-server/src/domains/types.ts`:

```ts
interface WorkspaceDomain {
	id: string;
	name: string;
	detect(workspacePath: string): Promise<boolean>;
	profile(root: string): WorkspaceProfile;
	systemPrompt: string;
	createTools(context: DomainContext): ToolDefinition[];
}
```

Detection must be local, deterministic, and cheap. A domain receives only the
selected workspace and the generic confirmation callback. It must not modify
global agent policy. Register bundled domains in `domains/registry.ts`.

## Web contract

The web domain registry turns active domain IDs into a generic `WorkspaceView`
and contributions. `App.svelte`, the title bar, and the shell render that
contract; they do not import Unity components or interpret Unity status.

An inspector receives an optional `onCollapse`. Render it in the panel header
with `PanelToggle` so the inspector can be closed from itself; it is absent
while the panel is collapsed, because the rail then owns that control.

Domain components live under `apps/app/src/lib/domains/` (or a domain-owned
feature directory while code is migrated). They may contribute the inspector,
dialogs, and settings. Keep runtime-specific state and polling behind that
boundary.

The new-thread dialog accepts any folder, seeds profiles from detected
extensions, and stores the initial profile setup. The desktop build uses a
native folder picker; browser development accepts an absolute path. Stored
projects appear in the dialog on later launches. The server announces the active
domain ID with the session-created event.

There is no current workspace. The sidebar lists every workspace as a row that
expands to its own threads, and the centre column shows either a thread or a
workspace. Opening a workspace (`#workspace/<path>`) replaces the thread column
while the sidebar and inspector stay put; it never opens or creates a thread.
A workspace screen has Overview and Settings tabs, so a workspace is configured
where it is shown rather than on a separate screen.

Threads do not exist outside a workspace: creating one requires a workspace, and
the row's `+` starts a thread in that workspace.

Workspace settings can select the active profile, add detected extension
profiles, toggle extension contributions for the active profile, set their roots
within the workspace, and remove the workspace from Gizmo. Removal does not
touch project files or existing threads. The thread sidebar groups sessions by
project, sorted by project name, while keeping each project's threads in
most-recent-first order.

## Included domains

### Unity

Detected by `ProjectSettings/`. It contributes Unity CLI/Pipeline tools, the
Editor lifecycle prompt, Editor inspector, Play Mode compile confirmation, and
Unity-hosted project extensions such as Console.

### Svelte

Detected when `package.json` declares `svelte` in dependencies or development
dependencies. It contributes Svelte-specific working guidance and a lightweight
changes/activity inspector. It intentionally has no custom tools yet; normal
coding and project scripts already cover the useful baseline.

### Default profile

Every folder can run with the Default profile. This preserves Pi's normal
default coding-agent prompt and tool behavior, with only Gizmo-managed skills
added according to global and profile-local settings. Generic coding is core
behavior rather than a separate extension.

## Adding a domain/profile default

1. Add detection, a profile default, prompt, and tools in a server domain directory.
2. Register it in the server registry.
3. Add its web view and contribution components to the web domain registry.
4. Add one focused detection/composition test and tests for any custom tools.
5. Keep protocol payloads generic. If a new contribution requires a host
   capability, design a reusable slot rather than adding a product-specific
   request to core.

The current Unity project transport predates this boundary and remains as a
compatibility adapter for Editor status and embedded project extensions. New
domains must not add parallel hard-coded request families; the next transport
revision should replace that adapter with opaque domain operations.
