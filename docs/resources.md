# Skills and agent resources

Gizmo manages the Pi resources that shape a session: skills, `AGENTS.md`
context files, prompt templates, and Pi extensions. These are separate from
workspace integrations ([domains.md](domains.md)) and from Unity project
extensions ([extensions.md](extensions.md)).

## Model

Skills are the only resource Gizmo turns on and off today. Two settings decide
whether a skill reaches a session:

- **Global (installed and enabled).** Every skill Gizmo discovers on disk is
  installed globally, so a skill is managed in one place no matter which
  directory it came from. A newly discovered skill is **off**: installing it
  makes it manageable, not active.
- **Workspace (enabled here).** A workspace may override the global setting for
  one skill, in either direction. Clearing the override restores the global
  setting.

Effective state is therefore `override ?? enabledGlobally`, and an uninstalled
skill is off everywhere regardless of any override.

Uninstalling is remembered. Discovery would otherwise reinstall the skill on the
next listing, so explicitly uninstalled IDs are recorded and skipped.

## Storage

| State                                                  | Location                                   |
| ------------------------------------------------------ | ------------------------------------------ |
| Installed, globally enabled, and uninstalled skill IDs | `resources.json` in Gizmo's data directory |
| Per-workspace overrides                                | `skills` on each entry in `projects.json`  |

Nothing is written into the user's repository. A workspace must be registered
with Gizmo before it can hold overrides.

## Locations

Gizmo reads only from folders it owns. Pi's agent directory keeps runtime
concerns — credentials, model configuration, its own settings — and nothing
there is put in front of the model.

| Scope     | Skills                                  | Prompts                                   | Context                         |
| --------- | --------------------------------------- | ----------------------------------------- | ------------------------------- |
| Global    | `~/.gizmo/skills/`, `~/.agents/skills/` | `~/.gizmo/prompts/`, `~/.agents/prompts/` | `~/.gizmo/AGENTS.md`            |
| Workspace | `.gizmo/skills/`, `.agents/skills/`     | `.gizmo/prompts/`, `.agents/prompts/`     | `AGENTS.md`, `.gizmo/AGENTS.md` |

`~/.agents/` is the cross-harness [Agent Skills](https://agentskills.io)
location, so skills shared with other tools work without being copied.
`~/.gizmo/` is also Gizmo's data directory, holding sessions, `projects.json`,
and `resources.json`; `GIZMO_DATA_DIR` moves all of it.

The first time Gizmo runs without a `~/.gizmo/skills/` directory, it copies
`~/.pi/agent/skills` and `~/.pi/agent/AGENTS.md` across, leaving the originals
untouched. It never does so again, so later edits are safe.

## Discovery

`discoverResources` hands the paths above to a Pi resource loader with every
one of Pi's own discovery locations disabled (`noSkills`, `noPromptTemplates`,
`noContextFiles`, `noExtensions`, `noThemes`). Pi parses and validates; Gizmo
decides what exists. A skill's scope is its location: inside the open workspace
is project scope, anything else is global.

Extensions are not listed or loaded. Gizmo runs sessions with `noExtensions`,
so showing Pi's extensions would imply an influence they do not have.

A skill's ID is `<scope>/<name>`, so a project skill never collides with a
global skill of the same name.

## Sessions

Sessions do not let Pi discover anything. `createDefaultPiSession` asks the
catalog for the enabled skill paths of the session's workspace and passes them
as `additionalSkillPaths`, supplies prompt directories the same way, and injects
`AGENTS.md` files through `agentsFilesOverride`. The catalog is the single
source of truth for what is active, and a skill that is off cannot leak into a
session through a Pi settings file or an ancestor directory.

## Protocol

| Request                   | Effect                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `resources.list`          | Catalog for a workspace, or global state when no path is given |
| `resources.skill.global`  | Change installed and/or enabled globally                       |
| `resources.skill.project` | Set or clear (`null`) one workspace's override                 |

Each returns the recomputed catalog, so the client never merges state itself.

## UI

Settings is a set of pages behind a left nav, grouped by who each page affects:
**This device** (Appearance, Chat, Context, Connection), then **Agent** and
About. Each page states its scope under the title, because the screen mixes
device preferences with machine-wide agent configuration.

**Agent** is one page covering everything the model loads, ordered by how
directly it applies: `AGENTS.md` files first, since they reach every session
unconditionally; then skills, which are installed and enabled here with search,
an on/off filter, and grouping by scope; then prompts. Only skills are
editable in the UI — the rest is reported so you can see what is influencing a
session, and edited on disk.

**Workspace settings** is its own screen (`#workspace-settings`), covering
integrations, per-workspace skill overrides, domain settings, and removal.

Pages are addressable: `#settings/agent` opens straight to Agent, and moving
between pages replaces the history entry rather than stacking one per click.

## Limitations

- Only skills are toggleable. Prompts and `AGENTS.md` files are listed for
  inspection.
- Installing means "discovered and managed". Downloading a skill from a
  repository is not implemented.
- The catalog is read on demand; there is no file watcher, so a skill added on
  disk appears the next time the screen is opened.
