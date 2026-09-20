# Project configuration

Gizmo is a general coding workbench. It does not inspect a folder to guess a
workspace type, and it has no per-workspace profile system. Instead, every
workspace follows the global settings — Gizmo extensions, Pi extensions,
skills, and built-in tools — and may override individual items locally.

## Model

- **Global settings are the default.** A workspace inherits everything:
  each globally installed Gizmo extension, each globally enabled Pi
  extension, every globally enabled skill, and the global built-in tool
  policy.
- **Overrides are per item.** The Configure screen lists each item with its
  effective state. Turning a row on or off records a project override;
  clearing the override inherits the global setting again.
- **Nothing is detected.** Adding a workspace never enables anything and
  never probes its contents. Activation is a user decision, made globally by
  default and adjusted per workspace only where needed.

## Storage

Workspace-owned state lives in `.gizmo/config.json` and contains only
overrides:

```json
{
	"version": 1,
	"gizmoExtensions": [{ "id": "svelte", "enabled": false }],
	"piExtensions": [{ "id": "notes", "enabled": false }],
	"skills": [{ "id": "global/review", "enabled": true }],
	"piExtensionPaths": ["/absolute/path/to/project-extension.ts"]
}
```

An absent section, or an absent row within it, means "inherit the global
setting". `piExtensionPaths` is the exception that is not an override: it
names Pi extension files or directories loaded only for this workspace's
sessions, managed with `project.extension-paths.set`. Nothing is discovered
from the workspace directory itself. Built-in tool overrides are the other
exception: they are written to the workspace's `.pi/settings.json`, the same
file `pi` itself reads, so Pi's project-trust rules apply.

A legacy `.gizmo/profiles.json` from the retired profile system is migrated
once: the active profile's extension list becomes an explicit per-workspace
snapshot (listed extensions stay on, the rest off), its skill overrides carry
over, and the old file is removed.

## Extension activation

- Gizmo integrations come from Pi extensions linked from user-configured Git
  registries. Linking installs the Pi extension and its optional Gizmo browser
  companion as one unit; a workspace may turn an extension on or off
  independently.
- An enabled Gizmo extension always contributes its tools and system-prompt
  guidance for sessions in workspaces where it is active. There are no
  separate tool/prompt modes.
- Pi extensions are enabled or disabled globally in Settings → Agent. A
  workspace can only turn an on extension off; it cannot force-enable one
  that is globally disabled.
- Disabled extensions are not probed: no tools, no guidance, no live project
  providers. Git status, for example, is not queried merely because a
  workspace happens to be a repository.

New sessions resolve the effective configuration when they start; changing a
toggle affects threads created afterwards.

## UI workflow

Opening a workspace shows it without creating a thread, on three tabs:

- **Overview** — how this workspace is set up, and everything that applies to
  all of it: a two-stat row (skills on, extensions on) that links into the tab
  that edits each, an "Overridden here" list naming only the items that depart
  from global, each revertable in place with **Use global**, the workspace's
  recent threads, and then the workspace `AGENTS.md` and the built-in tool
  override (via `.pi/settings.json`).
- **Skills** — skill overrides resolved per workspace, searchable and
  filterable by on/off/overridden, grouped by source directory.
- **Extensions** — Pi extension rows with inherit/override switches, project
  extension paths with add/remove (absolute file or directory), and
  extension-specific settings. Gizmo extension rows appear only for installs
  that still carry them.

Removing the workspace lives in the `…` menu beside **New thread**, not on a
tab. `#workspace/<path>/configure` links from before the split land on
Instructions & tools.

Every change applies immediately — there is no separate Save step. `AGENTS.md`
is the exception: it has Save and Revert, and leaving the tab with unsaved
text asks before discarding it.

## Adding an extension

1. Implement a normal Pi extension in a registry catalog entry.
2. Optionally export a named `gizmoExtension` for generic host capabilities and
   a `gizmoWebExtension` browser entry.
3. Add the extension to the registry's `gizmo.registry.json` catalog and build.
4. Do not add workspace detection to Gizmo. Activation is a user decision.
5. Keep extension-specific tests with the registry artifact.
