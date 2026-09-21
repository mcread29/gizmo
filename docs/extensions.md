# Extensions

Gizmo ships no extensions. An extension is a Pi extension written in
TypeScript that the server evaluates as-is; nothing is compiled, on the
user's machine or anywhere else. Whatever an extension shows in the Gizmo UI
is data described by `@gizmo/extension-api`, and the host renders it with its
own components. The design and its trade-off are recorded in
[extension-api.md](extension-api.md); this page describes what exists.

## The contract: `@gizmo/extension-api`

`packages/extension-api` is the one public package in the workspace. It
depends on TypeBox only; Pi's types are an optional peer. An extension file
default-exports its Pi factory and exports a named `gizmoExtension`:

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { defineExtension, gizmoView } from '@gizmo/extension-api';

export default function (pi: ExtensionAPI) {
	pi.registerTool({/* ... */});
}

export const gizmoExtension = defineExtension({
	id: 'notes',
	name: 'Notes',
	views: {
		recent: {
			label: 'Recent notes',
			open(context) {
				const push = () => context.update(render(context.workspacePath));
				push();
				const timer = setInterval(push, 1000);
				return {
					action: async (event) => {
						/* handle event.actionId */
					},
					dispose: () => clearInterval(timer),
				};
			},
		},
	},
});
```

`defineExtension` is an identity function that gives authors inference. Every
field but `id` and `name` is optional:

- **Agent-side** — `systemPrompt`, `createTools(context)`, `list`/`invoke`
  (RPC operations), `createProjectService` (a running external process with
  status/watch/open/revert; requests name the extension and are routed to
  its service), `packageRoot` for shipped skills and prompts, `dispose`.
- **UI** — `views`, `statusItems(context)`, `commands(context)` with
  `runCommand`, `settings` (a list of typed fields the host renders as a
  form and stores on the client), and `toolPresentation` (`labels`, `icons`,
  and `parameters` for tool cards). `activate(host)` hands the extension
  `host.uiChanged()` so it can ask clients to re-read its status items and
  commands when its own state changes.
- **Confirmations** — `context.confirm(kind, { title, message })` asks the
  user through the host's dialog; the answer is a boolean.

A **view** is `{ title, status?, badge?, blocks, actions? }` built from
blocks: `heading`, `text`, `markdown`, `keyValue`, `metric`, `list`,
`table`, `tree`, `progress`, `log`, `code`, `diff`, `split`, `section`,
`divider`. A `split` divides its space into panes that scroll on their own —
a file tree above the diff it selects — and stacks them when the panel is too
narrow to sit side by side. A `diff` in a pane takes the pane: it spans the
panel's full width and fills the height left to it rather than sitting in a
box, so give it a pane of its own.

Rows in a `list`, `table` or `tree` may carry an `icon` (a lucide name the
host knows; an unknown one is dropped rather than drawn as a puzzle piece)
and a `badge`, a short tone-tinted chip for a status letter. Actions may ask
for confirmation, take an input, or carry a selection; a block may also carry
a host intent (`openFile`, `openDiff`, `openThread`). An action with
`placement: 'item'` is drawn on every row of the block its `selection` names
and acts on that row, which is where a per-file verb belongs — a row whose
`actions` lists ids carries only those, for the folder that can be staged
whole but has no file to open; `group` weights
the rest of the bar (`primary`, `secondary` — icon-only when it has an icon —
or `overflow`, folded into a menu). A block's `onSelect` names an action the
host runs when a row is picked, which is how a detail pane follows the
selection; such an action is a block's behaviour, not a button, so the bar
leaves it out.
A view's `scope` is `workspace` or `thread` (the latter receives the open
thread's `sessionId`), and its `placement` is `inspector` or `modal`. Views
are size-bounded (`maxViewBytes`) and validated by the host with the same
TypeBox schemas the extension was typed against; an invalid update is dropped
with a warning rather than rendered.

Tool results use the same machinery: `gizmoDisplay(spec, { title })` for a
json-render card, or `gizmoView(view)` for a block view, both stored in the
tool result's `details` and read back with `readDisplayResult`.

The package is published on its own; its major is the extension API version
(`extensionApiVersion`). The app reports the major it supports and the
registry's release branch is named after it (see below).

### One copy of the API in the process

The server loads extensions through jiti with an `alias` that maps
`@gizmo/extension-api` to the copy inside the running Gizmo. A hand-written
extension needs no install to run; `npm i -D @gizmo/extension-api` is for
editor types and the extension's own tests. Every payload is validated
against the schemas the host renders, never against something an extension
bundled. The module cache is off, so a rescan re-evaluates the extension's
module graph from disk; that is what makes reload-in-place possible.

## Where extensions come from

| Source                | Directory                                                   | Trust                                                               |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Registry              | linked into `~/.gizmo/extensions/<id>`                      | Trusted; the user chose to link it.                                 |
| Global user extension | `~/.gizmo/extensions/<name>/` or `<name>.ts`                | Trusted; Gizmo owns the directory.                                  |
| Project-local         | explicit paths in `.gizmo/config.json` (`piExtensionPaths`) | Trusted; the user listed each path. Offered to that workspace only. |

Registry and global extensions are the global catalog. Project-local
extensions are named explicitly in each project's Gizmo config — nothing is
discovered from the workspace directory itself — rescanned at startup and on
reload alongside the globals. A project extension never shadows a global id
(a clash is logged and the local one dropped).

Enablement uses Gizmo's own enabled/disabled directories. Workspace
`piExtensions` overrides can disable an enabled extension for that workspace;
legacy `gizmoExtensions` overrides migrate on the next edit and legacy global
opt-outs migrate at server startup. On the first boot after the move from
`~/.pi/agent`, registry links are re-created in the new directories and
hand-written globals imported as copies; `~/.pi` is left to the Pi CLI.

## The extension registry

There is exactly one registry, `gizmo-registry`, and no setting names a URL.
Gizmo clones its `v<extensionApiVersion>` branch into
`~/.gizmo/registries/gizmo-registry/` the first time the catalog is asked
for, runs `pnpm install --frozen-lockfile` when the registry has a lockfile,
and remembers the commit. The registry's `gizmo.registry.json` declares
`gizmoApiVersion`; a registry declaring another major is refused before
anything is linked. The bootstrap is idempotent and shared between concurrent
callers; a failed clone is reported by `registry.status` rather than left
half-installed.

- `registry.link` / `registry.unlink` directory-link an extension into Gizmo's
  extension directory, so relative imports and registry dependencies
  resolve, then reload.
- `registry.update` fetches the branch tip, checks the manifest, reinstalls
  dependencies, re-syncs every linked extension (disabled links stay
  disabled), and reloads. `updateAvailable` compares the clone's HEAD with
  the remote branch without touching the clone.
- `registry.reset` unlinks everything the registry installed, removes the
  clone, and forgets the state. Hand-written extensions are never touched.

## How the UI reads an extension

Clients ask `extensions.ui` for the descriptors of every extension enabled in
a workspace: views, status items, commands, settings fields, tool
presentation, and whether it has a project service. A view is opened with
`extension.view.open`, which returns the first `View` and subscribes the
connection to `extension.view.updated` events; `extension.view.action`
delivers a clicked action and returns `{ status, message? }`;
`extension.view.close` releases it. A view instance is shared by every
connection that has it open and disposed when the last one closes, or when
the socket drops. `extension.command.run` runs a command; a command or status
item may instead name a view to open. `extensions.ui.changed` tells clients to
re-read one extension's descriptors.

## Reloading without a restart

`extensions.reload` (Settings → Extensions → Reload extensions, or `/reload`
in the composer) reloads every extension in place:

1. open views are disposed; the server catalog rescans, calling `dispose()`
   on each previous `gizmoExtension` and re-evaluating the module graph from
   disk;
2. project services are recreated from the new catalog, the old ones
   disposed, and live status watches re-subscribed;
3. every idle Pi runtime reloads. A session mid-turn is deferred and reloads
   when its turn settles; compaction also defers reload;
4. an `extensions.reloaded` event is broadcast, so every connected tab
   re-fetches descriptors and reopens its views.

Registry link, unlink, update, and reset run the same reload. In development
`GIZMO_EXTENSION_WATCH=1` makes the agent-server follow every linked
extension to its registry source and reload on any edit; the dev runner
excludes those directories from `tsx watch` so an edit never restarts the
process and kills a live thread. Because the module graph is re-evaluated
rather than unloaded, an extension that starts timers, sockets, or child
processes must implement `dispose` or they leak across reloads.

## Tool policy: Pi's `defaultTools` setting

Gizmo keeps no tool policy of its own. Which built-in tools a session starts
with is Pi's `defaultTools` setting: global state in the agent dir's
`settings.json`, with an optional per-workspace override in the workspace's
`.pi/settings.json`, subject to Pi's project-trust rules. Gizmo's settings UI
edits exactly those files — Settings → Agent for the global policy and the
workspace Configure screen for the override — through the `tools.policy.*`
protocol messages backed by
`apps/agent-server/src/settings/tool-policy.ts`.

On first read Gizmo seeds the global setting to `read`, `edit`, `write`, so a
fresh install keeps the historical no-shell default instead of Pi's
every-built-in default. Enabling every built-in in the UI reproduces Pi's
default, so the seed removes nothing. Extension tools, `run_script`, and any
other custom tools are always enabled and are not part of this policy: Pi's
`defaultTools` selects built-ins only. Policy changes apply to new threads and
to existing ones after Reload runtime.

Pi Web mode needs no special casing: it never passed a tool allowlist and
already followed this setting.

Pi extensions run headless (`json` mode) with Gizmo's browser-backed UI
context supplying `ctx.hasUI`. Tools, commands, provider registration,
lifecycle hooks, resource discovery, and prompt/context hooks run.
Terminal-specific UI contributions—custom TUI components, headers, footers,
editors, themes, and keybindings—have no web renderer and therefore degrade to
Pi's non-interactive behavior. The generic bridge adds select, confirm, input,
notification, and status primitives in Gizmo's native UI.

### `run_script`: the one execution primitive

Skills that ship an attached script (the [Agent Skills
standard](https://agentskills.io) supports this, and Pi's skill support is
built on it — see below) need _some_ execution primitive to run that script.
Rather than reopening `bash`, Gizmo owns one narrow tool, `run_script`
(`apps/agent-server/src/scripts/`), which executes a single `.ts`/`.js` file
via Bun in a subprocess with `shell: false`. The path and arguments are
passed as argv, so there is no interpolation, no pipes, no redirection, no
chained commands, and no `curl | sh`. Just "run this specific script file."

It enforces, and has tests for, each of:

- the resolved path stays inside the workspace;
- the extension is a JS/TS one — a `.sh` file is refused by name;
- the file exists;
- a default 60s timeout (caller-overridable to 600s);
- output capped and marked `truncated` rather than flooding the transcript;
- a non-zero exit is _reported_ as a result, not thrown, so the model can read
  stderr and react;
- a missing `bun` on PATH produces an explicit message rather than `ENOENT`.

**This means skills must be authored (or rewritten) as TypeScript/Bun
scripts, not shell scripts, to work in Gizmo.** A skill that ships a `.sh`
script — the common case for skills written against a Claude-Code-like
environment that assumes `bash` — will not run under this model as-is. That
incompatibility is accepted deliberately: the alternative is reopening
general shell execution, which is a materially larger trust surface for a
desktop app running arbitrary downloaded extensions.

Bun is a runtime prerequisite for `run_script` specifically; the rest of
Gizmo does not require it, and a missing Bun degrades to that one tool
failing with a clear message.

### `call` / `wait`: the same sandbox without a timeout

Long scripts use `call` instead of `run_script`: it starts the same
Bun subprocess (same workspace, `.ts`/`.js`-only, no-shell rules) with
no timeout and returns a call id immediately. The run keeps going while
the agent works; its result arrives as a follow-up message when it
settles, or the agent blocks for it with `wait`. `call_check` peeks,
`call_list` lists, and `call_cancel` stops a run. Aborting `wait` leaves
the run going. Implementation lives in
`apps/agent-server/src/scripts/` (`call-manager`, `call-tools`,
`call-state`) with delivery wiring in `src/pi-extensions/call-wait.ts`.

## Skills and prompts: Pi's job, not Gizmo's

Gizmo does not have (and should not build) its own skill/prompt package
format. Pi already has one:

- Skills already follow the Agent Skills standard: a `SKILL.md` plus
  supporting files in a folder, discovered from conventional directories or
  from a **Pi package**.
- **Pi packages** (`npm:`, `git:`, or a filesystem path) bundle extensions,
  skills, prompt templates, and themes together, declared either via a `pi`
  key in `package.json` (`{ "pi": { "skills": ["./skills"], ... } }`) or by
  convention directories (`skills/`, `extensions/`, `prompts/`, `themes/`) if
  no manifest is present. Pi ships install/update/list/remove commands,
  npm/git/path sources, and project-vs-user scope for these already.

Gizmo currently sets `noSkills: true` / `noExtensions: true` /
`noPromptTemplates: true` when creating a Pi session — it does not use Pi's
ambient package loading, instead passing `additionalSkillPaths`/
`additionalPromptTemplatePaths` explicitly (see
`apps/agent-server/src/sessions/pi-agent-service.ts`). A Gizmo extension that
ships skills rides this existing Pi mechanism rather than a parallel Gizmo
`skillsPath` convention and a second resource-discovery system.

A `GizmoExtension` may set `packageRoot` to its own package directory.
`apps/agent-server/src/resources/extension-resources.ts` then resolves the
skill and prompt directories that package ships, using Pi's own convention:

- a `pi` key in the package's `package.json`
  (`{ "pi": { "skills": ["./skills"], "prompts": ["./prompts"] } }`), or
- the conventional `skills/` and `prompts/` directories when no `pi` key
  declares them.

Declared directories that do not exist, or that resolve outside the package
root, are dropped — a manifest cannot reach out and contribute arbitrary
directories from the host machine.

The resulting paths join `additionalSkillPaths` /
`additionalPromptTemplatePaths`. Installing the extension package is the
opt-in for _discovery_ only: a shipped skill is registered as installed but
stays disabled until enabled through the normal resource catalog, exactly
like a skill found on disk. It never starts influencing sessions on its
own.

## Summary

- One fixed registry, pinned to the branch for this extension API major,
  cloned on demand; no build step anywhere.
- `@gizmo/extension-api` is the whole contract: agent capabilities and UI as
  data, validated by the host.
- Extensions come from the registry, `~/.gizmo/extensions`, or a workspace's
  explicit `piExtensionPaths`.
- Built-in tool availability remains Pi's `defaultTools` setting.

## Migration status and current limits

Extensions now use server-rendered view data throughout the registry. The host
supplies the API to both the Gizmo integration loader and Pi's independent
extension loader, including extensions outside the Gizmo checkout.

The registry currently uses a sibling-checkout link for API development and
tests; a published API dependency is still needed for standalone contributor
checkouts. Package publishing and the app installer remain separate release work.

The Activity entry has no view until the host exposes a tool-activity data source.
Inputs support text, multiline, and select; combobox suggestions, per-row actions,
and expanding truncated tool output are not part of this API. Git uses selection
plus actions and provides an inline diff; the generic `openDiff` intent currently
opens the file in the configured editor.
