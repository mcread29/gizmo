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
	"skills": [{ "id": "global/review", "enabled": true }]
}
```

An absent section, or an absent row within it, means "inherit the global
setting". Built-in tool overrides are the exception: they are written to the
workspace's `.pi/settings.json`, the same file `pi` itself reads, so Pi's
project-trust rules apply.

A legacy `.gizmo/profiles.json` from the retired profile system is migrated
once: the active profile's extension list becomes an explicit per-workspace
snapshot (listed extensions stay on, the rest off), its skill overrides carry
over, and the old file is removed.

## Extension activation

- Gizmo extensions are installed globally through `gizmo.extensions.json`.
  Installed means on globally; the toggle lives in Settings → Agent, and a
  workspace may turn an extension on or off independently.
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

Opening a workspace shows its Overview and Configure tabs without creating a
thread. Configure contains:

- Gizmo extension rows with inherit/override switches;
- Pi extension rows with the same model;
- skill overrides, resolved per workspace;
- the built-in tool override (via `.pi/settings.json`);
- extension-specific settings and workspace removal.

Every change applies immediately — there is no separate Save step.

## Adding an extension

1. Export one `GizmoServerExtension` from the package's `/server` entry.
2. Optionally provide prompt guidance, tools, live operations, a project
   service, and a browser bundle.
3. Add the package specifier to `gizmo.extensions.json`.
4. Do not add workspace detection. Activation is a user decision.
5. Add focused tests for activation and every contributed capability.
