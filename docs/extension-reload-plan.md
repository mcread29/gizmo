# Extension system: analysis and reload plan

Status: continued 2026-09-17. Reloading, host-owned builds, contributed display registries, manifest validation, and paired Pi/browser enablement are implemented. The published SDK and removal of the registry's private package copies remain open. The subagents/workflows entrypoints were split, but several supporting modules still exceed 300 lines, so phase 4 item 4 is only partly complete. Section 1 describes the system before this work.

### Continuation verification

- Reload requests queue changes arriving during an active scan instead of dropping them. The development watcher serializes its rebuilds.
- Failed web builds preserve the previous bundle. Replacement of legacy symlinks does not write through into registry source.
- Resident Pi runtimes refresh their explicit extension paths before reload. Streaming and compacting runtimes defer reload until settlement.
- A WebSocket integration test edits extension source and verifies that two connected clients receive the same generation while the process and connections stay alive.
- Registry links preserve disabled state across updates and remove disabled links on uninstall. Manifests reject unsupported API versions before link mutation; extensions without manifests retain legacy compatibility.
- Pi enablement controls paired server capabilities, browser delivery, and workspace activation. Legacy global opt-outs migrate at startup, and paired workspace overrides migrate when edited. Transitional package-only integrations retain their compatibility controls.
- The builder shares the host's design format/highlight modules and omits host design CSS. Registry-local UI components remain bundled until SDK migration.
- Display helpers validate tree/size and accept a per-node schema callback. Missing browser catalogs fall back to ordinary tool output.
- Registry verification uses an isolated temporary checkout because a running esbuild binary prevented an in-place dependency install. The registry lockfile and dependencies were repaired, including pinning TypeScript 6.0.3 for Unity's compiler API.
- Browser visual verification was unavailable: the preview host was absent and headless Chrome launch was blocked by policy. Component tests and production build are the UI verification evidence.

## 1. How the system works today

### Registry side (`~/.gizmo/registries/<name>`)

- `registry.add` shallow-clones the repo and runs the manifest's `build`
  command (`pnpm install --frozen-lockfile && pnpm build`). The registry's
  `scripts/build-extensions.ts` compiles every `extensions/<id>/src/web/index.ts`
  into a sibling `extensions/<id>.web.js`.
- `registry.link` creates a junction `~/.gizmo/extensions/<id>` pointing at
  `extensions/<id>/` and a file symlink `~/.gizmo/extension-web/<id>.web.js`.
  `registry.update` pulls, rebuilds, re-links, and rescans.
- Enabling/disabling a Pi extension moves the junction between `extensions/`
  and `extensions-disabled/` (`pi-global-resources.ts`).

### Server side (`apps/agent-server`)

The same directory is loaded twice, by two different loaders:

1. **Pi** loads `index.ts` per session through jiti with `moduleCache: false`
   and its own factory cache. `resourceLoader.reload()` calls
   `clearExtensionCache()`, so `session.reload` already re-reads extension
   source from disk. Pi side reload is essentially free.
2. **Gizmo** loads the optional named `gizmoExtension` export through native
   `import()` (`load-extensions.ts`). Node's ESM cache pins the module graph
   for the life of the process. `registryUpdate` documents this: a linked
   extension keeps running old code until restart.

Consequences:

- `rescanExtensionCatalog` re-registers the catalog, and `ExtensionHostService`
  reads it through a getter, so `list`/`invoke` follow a rescan. But the
  module code behind them is stale.
- `ProjectServiceRegistry` is built once in `server.ts` (documented "known
  limitation"). An extension linked or updated later has no project service
  until restart.
- `GizmoServerExtension` and `ProjectService` have no `dispose` hook, so
  nothing can be torn down even if the module were replaced.

### How the dev server restarts

`scripts/dev/dev-process.ts` runs the agent under `tsx watch`. tsx follows
imports through the junctions, so **saving any file under a linked extension
restarts the whole agent-server** and kills every live thread. Production
(`scripts/web-server.ts`) runs without watch, so the same edit never applies.
This is the behavior the user wants replaced.

### Web side (`apps/app`)

- `extensions.web` returns every bundle's source. `load-web-extension.ts`
  blob-imports it, validates `gizmoWebExtension` field by field, and
  `registerWebExtensions` replaces entries by id. The registry is reactive.
- `/reload` in the composer, registry actions, and Gizmo-extension toggles all
  call `store.reloadExtensions()`, which re-fetches bundles and resources.
  **Web hot reload already works** once a new `.web.js` exists. It only reaches
  the client that asked; other tabs stay stale. Old blob modules are never
  released (minor leak per reload).

### json-render

- The host shares `@json-render/core`, `@json-render/svelte`,
  `@json-render/svelte/schema`, and `zod` through `__gizmoHostModules__`.
  `apps/app/scripts/build-web-extension.ts` rewrites those specifiers, using a
  hand-kept export list in `json-render-exports.ts`.
- **The registry's `build-web-extension.ts` is a stale fork that rewrites only
  the two Svelte specifiers.** A registry extension importing json-render would
  bundle its own copy and break the documented contract in `docs/extensions.md`.
- **No registry extension uses json-render.** The only consumer is the built-in
  `display` Pi tool (`pi-extensions/display.ts`) with a fixed eight-component
  catalog rendered by `DisplayResult.svelte`. Extensions cannot contribute
  catalogs or reuse the renderer; every rich tool result is a bespoke Svelte
  component (`resultFor`).

### Registry inventory (11 extensions, all linked)

| id                | server                             | web surface                      | notes                                             |
| ----------------- | ---------------------------------- | -------------------------------- | ------------------------------------------------- |
| activity          | 9 lines, wraps `packages/activity` | inspector tab                    | thin wrapper                                      |
| ask-user          | 421 lines                          | labels, parametersFor, resultFor | ~300 lines of TUI code never runs in Gizmo        |
| codex             | 15 lines                           | activate, statusBar              |                                                   |
| git               | 23 lines, wraps `packages/git`     | full panel, 229 KB bundle        | bundles `@gizmo/design` + highlight.js            |
| ollama            | 62 lines                           | inspector tab                    |                                                   |
| search-and-scrape | 391 lines                          | labels, resultFor                |                                                   |
| skill-authoring   | 8 lines                            | none                             | skills only                                       |
| subagents         | 1206 lines                         | activate, resultFor              | over Gizmo's 300-line file limit if it lived here |
| svelte            | 12 lines                           | id only, 120-byte bundle         | empty web bundle still shipped and loaded         |
| unity             | 43 lines, wraps `packages/unity`   | full panel, 410 KB bundle        | project service; bundles design system again      |
| workflows         | 1483 lines                         | activate, resultFor              | same size concern as subagents                    |

Structural issues:

- The registry carries private copies of `packages/protocol`,
  `packages/extensions`, `packages/design`, and `packages/ui`. They drift from
  Gizmo's copies (the build-script fork is the proof). Types are not checked
  against the running host.
- Two identity systems coexist: Gizmo integration enablement (`integrations`
  per workspace) and Pi enablement (directory moves). An extension author has
  to reason about both.
- No per-extension manifest: `apiVersion`, capabilities, and whether a web
  bundle exists are discovered by reading files.

## 2. Goals

1. Editing a linked extension, or updating a registry, applies to the running
   server without a process restart and without killing idle threads.
2. Web bundles rebuild and re-load automatically; every connected client
   picks them up.
3. One web-extension builder, owned by Gizmo, so the json-render contract is
   real and cannot drift.
4. Extensions can use json-render as a first-class result renderer instead of
   hand-written Svelte per tool.

## 3. Plan

### Phase 1: stop the restarts, add an explicit reload (server)

1. **Exclude extension trees from tsx watch.** In `dev-process.ts` add
   `--ignore` globs for `~/.gizmo/extensions/**` and
   `~/.gizmo/registries/**`. tsx watch supports `--ignore`. This alone stops
   the thread-killing restarts; reload becomes an explicit operation.
2. **Load Gizmo integrations through jiti, not native `import()`.**
   `load-extensions.ts` creates a fresh `createJiti(..., { moduleCache: false })`
   per rescan and imports `index.ts` through it. The whole graph re-evaluates
   from disk, which is exactly what Pi already does. jiti is already in the
   dependency tree. Keep the `gizmoExtension` source-text pre-check.
3. **Add lifecycle hooks.** `GizmoServerExtension.dispose?()` and
   `ProjectService.dispose?()` in `@gizmo/extensions`. Rescan calls `dispose`
   on every replaced extension before dropping it.
4. **Make project services rebuildable.** Replace the once-built
   `ProjectServiceRegistry` with a live registry owned by the server. Rescan
   diffs by id: dispose removed/replaced services, create new ones, and tell
   `ProjectWatchCoordinator` to re-subscribe so status watchers survive.
5. **New request `extensions.reload`** (protocol v29) in
   `resource-request-handler.ts`:
   - optional `{ rebuild?: boolean }`: run the web build for linked
     extensions (see Phase 2) before rescanning;
   - rescan the catalog with a fresh module graph (steps 2 to 4);
   - for every active session: if idle, call `session.reload()` so Pi picks
     up new extension code; if streaming, mark it `reloadPending` and apply
     when the turn ends (hook the existing run-settled path in
     `session-operations.ts`);
   - broadcast a new `extensions.changed` event on the agent hub with the new
     catalog generation so **every** connected client re-runs
     `installWebExtensions` and `loadProjectExtensions`.
6. **Wire the UI.** `/reload` and the composer command call
   `extensions.reload` instead of only re-fetching bundles. Add a "Reload
   extensions" button to Settings → Extensions next to registry actions.
   Registry link/unlink/update use the same path.

### Phase 2: Gizmo owns the web build

1. **Delete the registry's `build-web-extension.ts` fork.** Move the builder
   from `apps/app/scripts` into a small workspace package
   (`packages/extension-build`) that the agent-server can import. It keeps the
   json-render and zod specifier rewrites and the `jsonRenderSvelteExports`
   list with its existing test.
2. **Build on link, update, and reload.** `syncExtension` builds
   `src/web/index.ts` into `~/.pi/agent/extension-web/<id>.web.js` directly.
   The registry manifest `build` becomes install-only (`pnpm install`).
   Registries no longer commit `.web.js` artifacts.
3. **Optional dev watcher.** `GIZMO_EXTENSION_WATCH=1` starts a debounced
   `fs.watch` (recursive) on each linked directory. A change under `src/web`
   triggers a web rebuild plus `extensions.changed`; any other change triggers
   the full `extensions.reload`. Default off in production.
4. **Release old blob modules.** Track loaded blob URLs per id and drop
   references on replace; call `dispose()` on every activated
   `WebExtensionRuntime` before re-activating in `WorkspaceInspector.svelte`.
5. **Skip empty bundles.** A `src/web/index.ts` that exports nothing but an
   id (the svelte extension) is not built or served.

### Phase 3: json-render as a real extension surface

1. **Extension-contributed catalogs.** Add `catalogs?: Record<string,
{ catalog: Catalog; registry: ComponentRegistry }>` to `GizmoWebExtension`.
   `load-web-extension.ts` validates the shape and namespaces catalog ids by
   extension id.
2. **Display envelope names a catalog.** Extend `DisplayEnvelope` with an
   optional `catalog: "<extensionId>/<name>"`. `DisplayResult.svelte` resolves
   the registry from the extension registry, falling back to the built-in
   catalog. Unknown catalogs fall back to plain tool-result rendering, as
   today.
3. **Server helper.** Export `gizmoDisplay(spec, { catalog })` from
   `@gizmo/extensions` so a Pi tool returns `details.gizmoDisplay` without
   hand-building the envelope. `parseDisplaySpec` gains a per-catalog schema
   hook so the server still validates size and tree shape.
4. **Migrate one extension as proof.** search-and-scrape's result cards are a
   list plus a table; port them to a catalog and delete
   `SearchToolResult.svelte`. Keep `resultFor` for genuinely interactive
   panels (subagents, workflows).
5. **Share `@gizmo/design` through host modules.** Add it to
   `sharedModules` with a tested export list. This removes the duplicated
   design system and highlight.js from the git and unity bundles (about
   640 KB today).

### Phase 4: registry hygiene

1. **Publish an SDK.** Move `@gizmo/extensions`, `@gizmo/protocol` types,
   `GizmoWebExtension`, and the builder into one package consumed by the
   registry as a git dependency pinned to the Gizmo version. Delete the
   registry's private copies of `protocol`, `extensions`, `design`, and `ui`.
2. **Per-extension manifest.** `extensions/<id>/gizmo.json` declaring
   `apiVersion`, `web: true|false`, and `capabilities`. `registry-catalog.ts`
   reads it instead of probing files, and the server refuses to link an
   extension whose `apiVersion` the host does not support.
3. **Collapse the thin wrappers.** activity, git, svelte, unity are 9 to 43
   line shims over `packages/*`. Move each package under its extension
   directory so an extension is one tree.
4. **Split subagents and workflows.** Both exceed Gizmo's own 300-line file
   limit several times over; apply `check:loc` in the registry.
5. **Drop dead TUI code from ask-user.** Gizmo binds extensions in `json`
   mode with `hasUI`, so the `ctx.mode === "tui"` branch never runs there.
   Keep it only if the registry is also meant for terminal Pi.
6. **One enablement model.** Retire the Gizmo `integrations` toggle in favor
   of Pi enablement, per the direction already recorded in
   `pi-extension-ui-bridge-plan.md`.

## 4. Verification

- Unit: `load-extensions` re-imports changed source across two rescans;
  project-service registry disposes replaced services; `extensions.reload`
  defers on a streaming session and applies on settle.
- Integration: edit a linked extension's `pi-extension.ts` while a thread is
  idle, call `/reload`, confirm the new tool description appears in the next
  turn and the agent-server PID is unchanged.
- Web: edit `src/web` of a linked extension, confirm the rebuilt bundle loads
  in two open tabs without a page reload.
- Builder tests: json-render export list matches the installed version;
  design-system export list matches.

## 5. Risks

- jiti re-evaluation keeps old module instances alive until GC. Extensions
  with global timers or sockets must implement `dispose`, or leak. Phase 1
  step 3 is a prerequisite for step 2, not an optional nicety.
- Pi `session.reload` clears composer command state and re-emits
  `session_start`; extensions that assume a single start per session may
  double-register. The journal extension already handles `reason: "reload"`.
- Building web bundles inside the agent-server pulls Vite and the Svelte
  compiler into the server process. Run it in a child process to keep the
  server's event loop free during a rebuild.
