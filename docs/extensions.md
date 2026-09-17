# Extensions

Gizmo ships no extensions. Every extension is installed from a user-selected
Git registry as a normal Pi extension. An extension may also export optional,
generic Gizmo integration capabilities and a paired browser bundle for panels,
project services, commands, status, and tool-result presentation.

Unity, Git, Svelte, Activity, Ask User, and Skill Authoring live in the
standalone `gizmo-registry` repository. Linking one catalog entry installs the
Pi backend and its Gizmo browser integration together; Gizmo contains no
static extension registry or first-party extension source.

## Contracts

Two small interfaces, one per side, mirror each other:

- **Server** — `GizmoServerExtension` (`@gizmo/extensions`): `id`, `name`,
  plus optional `systemPrompt`/`createTools` (active wherever the extension is
  enabled), optional `list`/`invoke` (live RPC-style
  operations the web UI can call), and optional `createProjectService`
  (a running external process with status/watch/open/revert). Project
  services are registered by extension id; since protocol v26, status/open
  requests name both the workspace and the extension, and the server routes
  each request directly to that extension's service. Status payloads are
  opaque extension-owned data: core never interprets them, so each
  extension ships the schema, validation, parsing, and errors for its own
  payloads (see Unity's `unity-wire.ts` in the gizmo-registry repository).
- **Client** — `GizmoWebExtension` (`apps/app/src/lib/extensions/types.ts`):
  `id`, plus optional `dialog`/`settings`/`hasProjectStatus`, optional
  `apiVersion`/`activate` (matched against a server-reported descriptor to
  activate live operations; the context it receives exposes `projectPath`,
  a live `sessionId` for the open thread, and `invoke`, so an extension that
  keeps per-thread state can pass the thread along in its invoke input), optional `inspectorTabs`/`commands`/`statusBar`
  (peer workspace-inspector tabs, commands, and titlebar indicators shown only
  while the extension is active), and
  optional `labels`/`iconFor`/`consoleEntriesKey`/`parametersFor`/`resultFor`/
  `diagnosticsComponent` (tool-result presentation).

Every field is optional. An extension contributes whatever it actually has;
it never has to implement capabilities it doesn't need.

A registry extension always default-exports its Pi factory from
`pi-extension.ts`. It may additionally export a named `gizmoExtension` object
for generic host capabilities. Its browser entry exports `gizmoWebExtension`.

## Git extension registries

Gizmo ships no Pi extensions. Users add Git registry repositories in
**Settings → Extensions**. Gizmo clones each repository once under
`~/.gizmo/registries/`, runs its declared build command, and links selected
extension directories into `~/.pi/agent/extensions/`.

A registry's `gizmo.registry.json` declares its extension directory, optional
install command (`build`, typically `pnpm install --frozen-lockfile`), and
catalog. Each extension directory contains `index.ts`, `pi-extension.ts`, and
may contain `src/web/index.ts`. Gizmo directory-links the extension into Pi so
relative imports and registry dependencies resolve correctly, and **builds the
browser bundle itself** from `src/web/index.ts` into
`~/.pi/agent/extension-web/<id>.web.js` as part of the same unit. A registry
that ships a prebuilt sibling `<id>.web.js` and no web entry is still linked
the old way. Registry repositories are independent of the Gizmo application
repository, so users download only extension source.

## Discovery

### Manifest and enablement

Registry extensions may declare `gizmo.json` with `apiVersion: 1`, a boolean
`web`, and a `capabilities` array of identifiers. Linking validates the manifest
before changing installed files; unsupported API versions are refused. A false
`web` skips the browser build and removes stale bundles. Legacy Pi extensions
without this sidecar remain compatible.

Paired extensions use Pi's enabled/disabled directories for both their backend
and browser integration. Workspace `piExtensions` overrides can disable an
enabled extension for that workspace. Legacy paired `gizmoExtensions` overrides
remain effective until the next edit migrates them, and legacy global opt-outs
migrate at server startup. Package-only integrations retain compatibility controls.
Updating a registry preserves disabled links; unlinking removes either location.

### Server: linked Pi extensions

At startup, Gizmo scans Pi's global extension directory. Each linked
`pi-extension.ts` is loaded by Pi through its default export. If the same file
also exports a named `gizmoExtension`, Gizmo registers those generic host
capabilities without knowing what the extension does. Linked extensions take
precedence over the now-empty transitional `gizmo.extensions.json` config.

Both loaders read the files through jiti with the module cache off, so every
scan re-evaluates the extension's whole module graph from disk. That is what
makes an in-place reload possible (see "Reloading" below); native `import()`
would pin the first graph for the life of the process.

### Client: runtime-loaded bundles

Vite — like any bundler — resolves import specifiers by static analysis at
build time, so the app's own build can never see a plugin installed later. The
way around it is to build the plugin separately and load it through a genuine
runtime `import(url)`, which the JS engine resolves itself.

**Building.** `@gizmo/extension-build` (`packages/extension-build`) compiles
an extension's `src/web` entry into one standalone ES module with no remaining
imports. The agent-server runs it in a child process when an extension is
linked, when a registry updates, and on every reload; `pnpm --filter
@gizmo/app extension:build <dir>` runs the same builder by hand. Gizmo owning
the build is what keeps the shared-module contract below honest: a registry no
longer carries its own copy of the builder that can drift.

The one thing a plugin must _not_ bundle is the Svelte runtime: two copies do
not share context or a reactivity graph, so a plugin carrying its own would
render but never update. Those specifiers are rewritten to read from a global
the host publishes (`__gizmoHostModules__`, see
`apps/app/src/lib/extensions/runtime/host-modules.ts`) rather than left
external and resolved through an import map — import-map support varies across
browsers, a global does not. The list of
names to re-export is read from the installed Svelte package at build time, so
it tracks the version in use; names that are reserved words (`if`, `await`,
`try`) are renamed in the export clause. The host also shares the pinned
json-render modules described below, plus `@gizmo/design/format` and
`@gizmo/design/highlight`. Host design CSS imports are omitted because the app
already includes those styles. Other components and icons are bundled normally.

### json-render for web extensions

Gizmo provides `@json-render/core` and `@json-render/svelte` at exactly `0.20.0`,
plus `zod` at `4.4.3`. These are host dependencies, not extension registrations.
Extensions define their own component catalogs, renderers, and action handlers.

Use these imports in an extension's browser code:

```ts
import { defineCatalog } from '@json-render/core';
import { defineRegistry, Renderer } from '@json-render/svelte';
import { schema } from '@json-render/svelte/schema';
import { z } from 'zod';
```

Gizmo's builder rewrites those four specifiers to use the host's modules, so
an extension never bundles its own json-render or Zod.

**Display catalogs.** A web extension can register json-render component
registries under `displayCatalogs`:

```ts
export const gizmoWebExtension = {
	id: 'search-and-scrape',
	displayCatalogs: { results: { ResultList, Result } },
};
```

A tool then returns a card as data instead of the extension shipping a bespoke
result component. On the server, `gizmoDisplay(spec, { catalog:
'search-and-scrape/results', title })` from `@gizmo/extensions` builds the
`details` envelope; the tool card renders it with the named registry through
the host's shared renderer. The host validates the tree and JSON budget
(`parseCatalogDisplaySpec`); prop shapes are the extension's own. A catalog no
installed extension provides falls back to the ordinary tool result.
`gizmoDisplay` validates the envelope on the server and accepts a `validateNode`
callback for extension-specific property validation.
`resultFor` remains for genuinely interactive results.

For local type checking, extension repositories should install the same exact
versions as development dependencies:

```sh
pnpm add -D -E @json-render/core@0.20.0 @json-render/svelte@0.20.0 zod@4.4.3
```

Only the listed specifiers are shared. Other subpaths are not part of this
contract. Backend Pi extensions still need their own dependencies; browser host
modules are not available in Node. When upgrading json-render, update both pins,
review `packages/extension-build/src/json-render-exports.ts`, and run the
extension builder tests. The tests check that the renderer export list matches
the installed version.

### Bundle delivery

**Delivering.** Linking places browser companions under
`~/.pi/agent/extension-web/`, outside Pi's backend auto-discovery directory.
This prevents Pi from trying to execute Svelte browser code as an extension.
The server returns those bundles over the existing agent WebSocket in response
to `extensions.web`.

**Loading.** `runtime/load-web-extension.ts` turns the source into a blob URL
and imports it. A bundle must export `gizmoWebExtension`, and its `id` must
match the id it was served as — otherwise an extension could impersonate
another. One failing bundle is reported and skipped rather than taking the
whole extension surface down.

**Validation.** Past that identity check, the loaded object comes from code
Gizmo does not control. Every optional field is checked against the shape
`GizmoWebExtension` promises — `dialog`/`settings`/`activate`/etc. must
actually be functions, `labels` must be a string-to-string record, and so on
— and a field that fails is dropped individually rather than the whole
bundle: a plugin with one malformed field loses just that capability, with a
diagnostic naming it, instead of surfacing a raw `TypeError` deep inside a
Svelte render (or failing to load at all over one bad field).

**Runtime isolation.** The published host-module set
(`__gizmoHostModules__`) is `Object.freeze`d and defined non-writable and
non-configurable on `globalThis`. A loaded plugin still runs in the main
page — this is not a sandbox — but it cannot swap the shared Svelte runtime
for one it controls and hand a poisoned module to every other extension
sharing the same global. Real code-execution isolation (an iframe sandbox,
or hash-pinning a bundle so a silently updated dependency cannot swap code
under an id already trusted) is future work, not yet done.

**CSP.** Importing a blob URL as a module requires `script-src 'self' blob:`
in whatever CSP the app is served under. A bare `default-src 'self'` (with no
`script-src`) blocked it; both the block and the fix were confirmed in a real
Chromium against the exact CSP strings. This does loosen the policy — it is
the cost of loading third-party UI code at all, and is why bundles arrive only
from extensions the user explicitly linked from a registry.

_Not verified:_ the blob-import path was confirmed in Chromium, not in WebKit.

**No built-ins.** `registry.svelte.ts` starts empty. Every browser integration
arrives through `extensions.web`; duplicate ids are de-duplicated at runtime.
The registry is reactive, so extensions that arrive after first render still
reach the UI.

## Reloading without a restart

`extensions.reload` (Settings → Extensions → Reload extensions, or `/reload`
in the composer) reloads every linked extension in place:

1. web bundles rebuild from source for every linked extension with a web
   entry;
2. the server catalog rescans: each previously linked `gizmoExtension` gets
   `dispose()` if it defines one, then the module graph re-evaluates from disk;
3. project services are recreated from the new catalog
   (`ProjectServiceRegistry.replace`), the old ones disposed, and live
   status watches re-subscribed;
4. every idle Pi runtime reloads (Pi clears its own extension cache on
   `session.reload`, so it re-reads the same files). A session mid-turn is
   deferred and reloads when its turn settles; compaction also defers reload.
   The explicit extension-path array is refreshed so newly linked and removed
   extensions affect resident runtimes;
5. an `extensions.reloaded` event is broadcast, so **every** connected tab
   re-fetches bundles and descriptors.

Registry link, unlink, and update run the same reload. In development
`GIZMO_EXTENSION_WATCH=1` makes the agent-server follow every linked
extension to its registry source: an edit under `src/web` rebuilds that bundle
and notifies clients; any other edit runs the full reload. The dev runner
excludes the extension directories from `tsx watch` so an edit there never
restarts the process and kills a live thread. Because the module graph is
re-evaluated rather than unloaded, an extension that starts timers, sockets,
or child processes must implement `dispose` or they leak across reloads.

Web builds replace installed bundles only after success. Failed builds retain
the previous version and return diagnostics. Reloads arriving during a scan
queue another pass so subsequent edits are not lost.

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

A `GizmoServerExtension` may set `packageRoot` to its own package directory.
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

Pi extensions are the unit of installation. A registry entry always supplies
a normal `(pi: ExtensionAPI) => ...` extension and may additionally expose
Gizmo host capabilities and a browser bundle. Gizmo does not maintain a
separate built-in extension catalog.

## Summary

- User-curated Git registries are cloned and built locally.
- Selected extension directories are linked into Pi's extension directory.
- Browser bundles are linked separately so Pi never executes browser imports.
- Optional named `gizmoExtension` exports provide generic server capabilities.
- Optional `gizmoWebExtension` bundles are loaded over the agent connection.
- Built-in tool availability remains Pi's `defaultTools` setting.
- Extension-specific prompts, tools, skills, services, tests, and UI live with
  their registry artifacts.
