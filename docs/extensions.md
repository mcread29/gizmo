# Extensions

> **Planned direction:** The current contract documented below will eventually
> be rebuilt on Pi extensions, beginning with the generic browser UI bridge in
> [Pi Extension UI Bridge Plan](pi-extension-ui-bridge-plan.md). Until that
> migration is complete, this document describes the active implementation.
> The first bridge milestone is now active: standard Pi extension dialogs,
> notifications, statuses, text widgets, working-state overrides, titles, and
> composer text operations use native Gizmo UI.

Gizmo owns exactly one integration contract: the extension. There is no
separate "domain" concept — tools, system prompt guidance, a live project
process, and UI (dialogs, panels, tool-result rendering) are optional
capabilities an extension may contribute. Extensions are installed globally
and enabled by default; workspaces may override them, and Gizmo does not
detect workspace types. Core knows no runtime-specific extension types.

Unity is the largest extension today. Git, Svelte, and Activity are
extracted the same way: standalone first-party packages (`@gizmo/unity`,
`@gizmo/git`, `@gizmo/svelte`, `@gizmo/activity`) listed in
`gizmo.extensions.json` like any third-party one. On the server, none of
them is special-cased — each is loaded, registered, and dispatched through the
exact same mechanism a third-party extension would use. On the client,
Svelte/Git/Activity are statically bundled as builtins (the app bundles them
anyway); Unity is the first extension that ships only as a runtime web bundle
and arrives over `extensions.web`, exercising the same path any third-party
web extension would.

## Contracts

Two small interfaces, one per side, mirror each other:

- **Server** — `GizmoServerExtension` (`@gizmo/extensions`): `id`, `name`,
  plus optional `systemPrompt`/`createTools` (active wherever the extension is
  enabled), optional `list`/`invoke` (live RPC-style
  operations the web UI can call), and optional `createProjectService`
  (a running external process with status/watch/open/revert).
- **Client** — `GizmoWebExtension` (`apps/app/src/lib/extensions/types.ts`):
  `id`, plus optional `dialog`/`settings`/`createView`/`hasProjectStatus`
  (workspace UI), optional `apiVersion`/`activate` (matched against a
  server-reported descriptor to activate live operations), optional
  `inspectorTabs`/`commands`/`statusBar` (a workspace inspector tab, command,
  and titlebar indicator shown only while the extension is active), and
  optional `labels`/`iconFor`/`consoleEntriesKey`/`parametersFor`/`resultFor`/
  `diagnosticsComponent` (tool-result presentation).

Every field is optional. An extension contributes whatever it actually has;
it never has to implement capabilities it doesn't need.

Unity's server package exports exactly one object, `gizmoExtension`, from
`@gizmo/unity/server`. Its web package exports exactly one object,
`unityWebExtension`, from `@gizmo/unity/web`. Nothing else about Unity's
internals is part of the public surface.

## First-party Pi extensions

Capabilities that belong to every Gizmo install ship as paired packages in
`packages/` — currently `@gizmo/ask-user`, the multiple-choice question tool.
A paired package contains the Pi extension (`pi-extension.ts`, which the agent
server embeds, seeds into the data dir at startup, and loads for every
session) and, when the tool has its own presentation, a web extension
(`src/web/`) that the app bundles statically. A same-named extension in the
user's agent dir takes precedence over the shipped one. Edit the Pi extension
and run `pnpm extensions:generate` to refresh the embedded copy.

## Discovery

### Server: runtime-loaded, config-driven

`gizmo.extensions.json` at the repo root (overridable via
`GIZMO_EXTENSIONS_CONFIG`) lists extension specifiers:

```json
{ "extensions": ["@gizmo/unity"] }
```

At startup, `apps/agent-server/src/extensions/load-extensions.ts` reads this
file and dynamically `import()`s each entry's `<specifier>/server` subpath,
expecting a `gizmoExtension` export. A specifier can be a bare package name
(npm-resolved) or a filesystem path — both work with Node's `import()` with
no bundler involved. A missing config file or a failed load is skipped with a
warning rather than crashing startup — this is already the graceful-fallback
behavior, verified by running the server with no config present.

`server.ts` never names an extension. It calls `loadServerExtensions()`,
registers the result into
`apps/agent-server/src/extensions/registry.ts`, and wires
`ExtensionHostService` and the project-service factory generically from
whatever was loaded.

This already supports the "someone else installs an npm package and lists it
in settings" case with no further work: `npm install` (or a git checkout) any
package exporting `gizmoExtension` from a `/server` subpath, add its
specifier to `gizmo.extensions.json`, done.

### Client: runtime-loaded bundles

Vite — like any bundler — resolves import specifiers by static analysis at
build time, so the app's own build can never see a plugin installed later. The
way around it is to build the plugin separately and load it through a genuine
runtime `import(url)`, which the JS engine resolves itself.

**Building.** `apps/app/scripts/build-web-extension.ts` (`pnpm --filter
@gizmo/app extension:build <package-dir>`) compiles a package's `src/web`
entry into one standalone ES module with no remaining imports.

The one thing a plugin must _not_ bundle is the Svelte runtime: two copies do
not share context or a reactivity graph, so a plugin carrying its own would
render but never update. Those specifiers are rewritten to read from a global
the host publishes (`__gizmoHostModules__`, see
`apps/app/src/lib/extensions/runtime/host-modules.ts`) rather than left
external and resolved through an import map — import-map support varies across
the webviews Tauri uses on different platforms, a global does not. The list of
names to re-export is read from the installed Svelte package at build time, so
it tracks the version in use; names that are reserved words (`if`, `await`,
`try`) are renamed in the export clause. Everything else a plugin imports —
`@gizmo/design` components, icons — is bundled into it normally.

**Delivering.** The server reads each extension's built `dist/web.js`
(`apps/agent-server/src/extensions/web-bundles.ts`) and returns the source
over the existing agent WebSocket in response to `extensions.web`. Sending
source over the connection Gizmo already has avoids standing up an HTTP
server just to host plugin assets.

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
in `apps/app/src-tauri/tauri.conf.json`. The previous `default-src 'self'` (with no
`script-src`) blocked it; both the block and the fix were confirmed in a real
Chromium against the exact CSP strings. This does loosen the policy — it is
the cost of loading third-party UI code at all, and is why bundles arrive only
from extensions the user installed and listed in `gizmo.extensions.json`.

_Not verified:_ the blob-import path was confirmed in Chromium (which is what
Tauri uses on Windows and what WebView2 is built on), not in WebKitGTK, which
Tauri uses on Linux.

**Built-ins still win.** `registry.svelte.ts` keeps first-party extensions
(Svelte, Git, Activity) statically imported, because the app bundles them
anyway, and a runtime-loaded bundle claiming one of their ids is discarded
rather than allowed to displace it. Unity is not in that set — it only ever
arrives at runtime over `extensions.web`, the same path a third-party
extension would use. The registry is reactive, so extensions that arrive
after first render still reach the UI; startup never blocks on them.

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

Pi's own "Extensions" concept (a TypeScript module with a
`(pi: ExtensionAPI) => ...` default export, registering providers, commands,
or TUI customization) is a different, adjacent thing from a
`GizmoServerExtension` — it extends Pi's own agent runtime, not Gizmo's
workspace/UI layer. Gizmo disables ambient Pi extensions
(`noExtensions: true`) and does not currently expose this to Gizmo
extensions. Whether/how to bridge the two is an open question, not a
decision made yet.

## Summary: what's implemented

**Implemented:**

- Unified `GizmoServerExtension` / `GizmoWebExtension` contracts, no
  domain/extension split.
- Server-side runtime discovery via `gizmo.extensions.json` + dynamic
  `import()`, with graceful fallback.
- Built-in tool availability is Pi's `defaultTools` setting, seeded to
  `read`, `edit`, `write`, editable globally and per workspace.
- `run_script` (Bun, `.ts`/`.js` only, no shell) as the sole additional
  execution primitive.
- Extension-shipped skills and prompts via `packageRoot` + Pi's package
  convention, feeding `additionalSkillPaths`.
- Client-side runtime loading: standalone plugin builds sharing the host's
  Svelte runtime, delivered over the agent connection, imported from a blob
  URL.

**Open:**

- Whether a Gizmo-specific manifest (declaring an extension's capabilities
  before its code is executed, mirroring Pi's `pi` package.json key) is worth
  adding once there's a real third-party ecosystem to protect against.
- Whether/how Pi's own "Extensions" concept composes with
  `GizmoServerExtension`.
- Whether blob-URL module imports behave the same under WebKitGTK, which
  Tauri uses on Linux. Verified under Chromium only.
