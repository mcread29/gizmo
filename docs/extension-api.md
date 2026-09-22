# The extension API package

This is the design that replaced the browser-bundle mechanism before the
first release. It records the decision and its trade-off;
[extensions.md](extensions.md) describes what was built, where the names
differ (`views` rather than `panels`, `placement: 'modal'` rather than
`dialog`).

## The decision

Extensions ship no browser code. An extension is a Pi extension written in
TypeScript, loaded by the server through jiti as today, and everything it
shows in the Gizmo UI is data: a tool result card, a panel, a status item, a
command, a settings form, a dialog. The host renders that data with its own
components. There is no build step, on the user's machine or in the
registry, and no shared Svelte runtime to keep in step.

The trade-off is accepted knowingly: an extension cannot ship a custom
component. When a block type is missing, it is added to the host, and every
extension gets it.

The contract is a real package, `@gizmo/extension-api`, published to npm and
versioned on its own, so an extension does not have to live in the registry.
The same package serves the registry, a user's global extensions, and
project-local extensions.

## What the package contains

One package, no runtime dependency on Svelte, Pi, or the Gizmo app:

- **`GizmoExtension`** — what today's `GizmoServerExtension` is: `id`,
  `name`, optional `systemPrompt`, `createTools`, `invoke`,
  `createProjectService`, `dispose`. Plus the UI contributions below, all
  optional.
- **View protocol types and schemas** — promoted from the registry's
  `orchestration/declarative-ui.ts`. Blocks: `text`, `markdown`, `keyValue`,
  `list`, `table`, `progress`, `log`, `code`, `divider`, `split`, and the two
  the git and Unity ports need, `tree` and `diff`. Actions with `confirm`,
  `input`, `selection`, `placement` and `group`; a row may narrow the `item`
  actions it carries with its own `actions`. Host intents: `openFile`, `openDiff`, `openThread`. A
  `View` is `{ title, status?, blocks, actions? }`. Schemas are TypeBox, the
  same library `@gizmo/protocol` already uses, so the host validates every
  payload against the schema the extension was typed against.
- **Contribution types** — `panel`, `statusItem`, `command`, `settings`
  (typed fields — `text`, `number`, `boolean`, `select`, `model` — whose
  values the server stores globally in `extension-settings.json` and hands
  back on every context; see [extensions.md](extensions.md)), `dialog` (a
  modal `View`), and `toolPresentation`
  (`labels`, `iconFor`, `parametersFor`, and a `display` for result cards).
- **`gizmoDisplay`** — the existing result-card helper, moved here unchanged.
- **`defineExtension(extension)`** — an identity function that gives
  authors type inference and lets the loader recognise an extension export
  without a manifest.
- **Pi types** as a peer: `ToolDefinition` and Pi's `ExtensionAPI` come from
  `@earendil-works/pi-coding-agent`, which every extension already has.

Nothing in the package reaches into the app, so it can be tested with
`vitest` outside Gizmo. The registry's `extensions` package and Gizmo's
`packages/extensions` both become this one package.

## How a panel works

Today Codex, Ollama, Subagents, and Workflows each poll an `invoke` operation
from the browser once a second and render the answer with their own Svelte.
With the API, the extension owns the data and the host owns the rendering:

```ts
import { defineExtension, type View } from '@gizmo/extension-api';

export const gizmoExtension = defineExtension({
  id: 'subagents',
  name: 'Subagents',
  panels: {
    subagents: {
      label: 'Subagents',
      // Called when a client opens the tab; the returned handle pushes
      // updates and is disposed when the last client closes it.
      open(context) {
        const timer = setInterval(() => context.update(render(context.sessionId)), 1000);
        return { dispose: () => clearInterval(timer) };
      },
      // Actions declared in the View come back here.
      action(id, payload, context) { ... },
    },
  },
});
```

`context.update(view)` rides the existing extension event channel; the host
keeps the latest `View` per panel and renders it. Actions are an `invoke`
with a reserved operation name, so no new transport is needed. The browser
never polls.

Tool result cards keep the `gizmoDisplay` path unchanged. Status items and
commands are plain data returned from `statusItems()` and `commands()`; a
command's `run` is an action id.

## Where extensions come from

Three places, one loader:

| Source                | Directory                                                                   | Trust                                                               |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Registry              | linked into `~/.gizmo/extensions/<id>`                                      | Trusted; the user chose to link it.                                 |
| Global user extension | `~/.gizmo/extensions/<name>/` or `<name>.ts`, written by hand               | Trusted; Gizmo owns the directory.                                  |
| Project-local         | explicit paths in the workspace's `.gizmo/config.json` (`piExtensionPaths`) | Trusted; the user listed each path. Loaded only for that workspace. |

Global and registry extensions are the global catalog, rescanned on reload as
today. Project-local ones are named explicitly in the project's Gizmo config,
so nothing is discovered from the workspace directory itself, and their
panels, tools, and cards are available only in that workspace. `~/.pi` is
left entirely to the Pi CLI; on first boot after the move, registry links are
re-created in the new directory and hand-written globals imported as copies.

A single file is enough for a small extension: `~/.gizmo/extensions/notes.ts`
that default-exports a Pi factory and exports `gizmoExtension`. Directories
with a `package.json` are for extensions with dependencies.

## Resolving the package at runtime

The host always supplies the package. jiti loads extensions with an `alias`
that maps `@gizmo/extension-api` to the copy inside the running Gizmo, so:

- A hand-written extension needs no `npm install` to run. `npm i -D
@gizmo/extension-api` next to the extension is only for editor
  types and for running the extension's own tests.
- There is exactly one version of the schemas in the process, and it is the
  host's. A payload is validated against what the host renders, never against
  what the extension bundled.
- The registry's lockfile pins the package for type-checking and tests, but
  the version it pins never runs inside Gizmo.

Compatibility is the package's major version. An extension declares nothing
extra; the host reports its API major in `registry.status` and in the
Settings → Extensions catalog, and refuses a registry branch whose
`gizmoApiVersion` differs. `apiVersion: 1` in `gizmo.json` goes away, and so
does `gizmo.json` itself: `web` was only there to skip the build.

## Publishing

- The package lives in this repo at `packages/extension-api` and is the one
  public package in the workspace. `private` is dropped and `exports` point
  at built `.js` and `.d.ts`; it is the only thing in Gizmo that gets a
  compile step, and it happens at publish, not at install.
- Its version is independent of the app's. Major is the extension API
  version. The app's `RELEASE.json` records which major it ships, and the
  registry's release branch is named after it (`v1`, `v2`), as in
  [release.md](release.md).
- Publishing is a job in the release workflow that runs when
  `packages/extension-api/package.json` changes version, with npm provenance.

The `@gizmo` npm scope has to be available or the package needs another
name; that is checked before the first publish.

## What is removed

- `packages/extension-build`, the server's `web-build.ts` and the bundle
  rebuild on every reload, `apps/app/src/lib/extensions/runtime/*`, the
  `__gizmoHostModules__` global, and `~/.pi/agent/extension-web/`.
- The registry's `build` command; install is `git clone` plus
  `pnpm install --frozen-lockfile` for server dependencies.
- The web halves of every registry extension, and the registry's `design`,
  `ui`, and `svelte` packages that existed to serve them.
- The `extensions.reload` request's `rebuild` flag.

## Order of work

1. Create `packages/extension-api` from `packages/extensions`, the view types
   from the registry's `orchestration` package, and `gizmoDisplay`. Add the
   jiti alias. Nothing changes behaviour yet.
2. Host: a `View` renderer (blocks, actions, intents), panel subscription
   over the event channel, status items and commands from data, a
   schema-driven settings form, and a modal for `dialog`.
3. Port the registry extensions smallest first: Codex, Activity, Ollama,
   Subagents, Workflows, then Ask User and Search & Scrape, which only lose
   their result components in favour of `gizmoDisplay` catalogs the host
   provides.
4. Move Changes into the host; drop Git's web code.
5. Port Unity: console as a `log` block with filters, settings as a schema
   form, the dialog as a modal `View`.
6. Delete everything under "What is removed", read explicit project
   extension paths per workspace, publish `@gizmo/extension-api@1.0.0`, cut
   the registry's `v1` branch, and rewrite [extensions.md](extensions.md) to
   describe this.
