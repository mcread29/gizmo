# Workspace profiles

Gizmo is a general coding workbench. It does not inspect a folder to guess a
workspace type. Gizmo extensions are installed globally through
`gizmo.extensions.json` and enabled explicitly in each workspace profile.

A newly added workspace starts on **Default** with no Gizmo extensions enabled.
Opening a folder never enables Unity, Svelte, Git, Activity, or another Gizmo
extension automatically.

## Storage and defaults

`projects.json` stores workspace catalog metadata such as path, title, and added
time. Workspace-owned profile state is stored in `.gizmo/profiles.json`.

Gizmo materializes canonical profiles from core and the currently installed
extension packages whenever profiles are read. Canonical profiles use sources
such as `builtin:default` and `extension:svelte`; a stale saved copy cannot
replace the installed default.

Canonical profiles are editable in the Configure screen:

- The first changed value creates a `workspace:temporary` profile based on the
  canonical profile.
- The canonical profile itself is never mutated.
- The override remains saved while at least one value differs, so it survives a
  restart.
- Reverting the final difference removes the override and returns selection to
  the canonical profile.

Profiles created with **New profile** are normal workspace profiles. They remain
saved even when their values happen to match Default, and they can still be
renamed, duplicated, activated, and deleted.

## Extension activation

The Configure screen lists every globally installed Gizmo extension. Each row
is an explicit profile checkbox and defaults to off. Enabled extensions use the
workspace root (`.`) unless the profile contains another validated relative
root.

The active profile controls new sessions:

- only listed extensions are activated;
- extension tools are added only when the profile's tool mode allows them;
- extension prompt guidance is added only when its prompt mode allows it; and
- extension commands, titlebar status, inspector tabs, dialogs, and settings are
  hidden when that extension is inactive.

Live project providers are not probed for disabled extensions. For example, Git
status is not queried merely because a workspace happens to be a repository.

## UI workflow

Opening a workspace shows its Overview and Configure tabs without creating a
thread. Configure contains the profile selector, extension activation, tool and
prompt policy, skill overrides, extension-specific settings, and workspace
removal.

Edits remain local until **Save**. **Revert** restores the last saved shape.
**Revert all** restores the selected profile's base. Threads require a workspace;
the workspace row's `+` starts a thread using its active profile.

## Included extensions

The default global catalog is configured in `gizmo.extensions.json` and
currently includes Unity, Svelte, Git, Activity, and Skill Authoring. Their
presence in that file means they are installed, not enabled for every project.

- **Unity** contributes Unity tools, guidance, project service, and browser UI
  when enabled.
- **Svelte** contributes Svelte guidance and browser presentation when enabled.
- **Git** contributes Git status tooling and UI when enabled.
- **Activity** is a browser contribution shown when enabled.
- **Skill Authoring** ships skill resources; skill enablement remains visible in
  the profile's Skills section.

## Adding an extension

1. Export one `GizmoServerExtension` from the package's `/server` entry.
2. Optionally provide a canonical profile, prompt guidance, tools, live
   operations, project service, and browser bundle.
3. Add the package specifier to `gizmo.extensions.json`.
4. Do not add workspace detection. Activation is a user decision.
5. Add focused tests for manual activation and every contributed capability.
