# Extensions

Gizmo owns exactly one integration contract: the extension. There is no
separate "domain" concept — workspace detection, tools, system prompt, a live
project process, and UI (dialogs, panels, tool-result rendering) are all just
optional capabilities an extension may contribute. Core knows only that
contract; it has no extension categories, no runtime-specific types, and no
hardcoded knowledge of any specific extension (Unity included).

Unity is the one extension that exists today. It is not special-cased
anywhere in core — it is loaded, registered, and dispatched through the exact
same mechanism any third-party extension would use.

## Contracts

Two small interfaces, one per side, mirror each other:

- **Server** — `GizmoServerExtension` (`@gizmo/extensions`): `id`, `name`,
  plus optional `detect`/`detectRoots`/`profile`/`systemPrompt`/`createTools`
  (workspace integration), optional `list`/`invoke` (live RPC-style
  operations the web UI can call), and optional `createProjectService`
  (a running external process with status/watch/open/revert).
- **Client** — `GizmoWebExtension` (`apps/app/src/lib/extensions/types.ts`):
  `id`, plus optional `dialog`/`settings`/`createView`/`hasProjectStatus`
  (workspace UI), optional `apiVersion`/`activate` (matched against a
  server-reported descriptor to activate live operations), and optional
  `labels`/`iconFor`/`consoleEntriesKey`/`parametersFor`/`resultFor`/
  `diagnosticsComponent` (tool-result presentation).

Every field is optional. An extension contributes whatever it actually has;
it never has to implement capabilities it doesn't need.

Unity's server package exports exactly one object, `gizmoExtension`, from
`@gizmo/unity/server`. Its web package exports exactly one object,
`unityWebExtension`, from `@gizmo/unity/web`. Nothing else about Unity's
internals is part of the public surface.

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

`server.ts` never names Unity. It calls `loadServerExtensions()`, registers
the result plus the always-on `svelteExtension` into
`apps/agent-server/src/extensions/registry.ts`, and wires
`ExtensionHostService` and the project-service factory generically from
whatever was loaded.

This already supports the "someone else installs an npm package and lists it
in settings" case with no further work: `npm install` (or a git checkout) any
package exporting `gizmoExtension` from a `/server` subpath, add its
specifier to `gizmo.extensions.json`, done.

### Client: still statically registered

`apps/app/src/lib/extensions/registry.ts` currently imports `@gizmo/unity/web`
directly and returns a static array. This is the one piece that hasn't moved
to runtime discovery yet, because it's a materially harder problem: Vite (like
any bundler) resolves import specifiers by static analysis at build time, so
loading a plugin the app's build never saw requires a genuinely different
mechanism — building the plugin as a standalone module with `svelte`
externalized so it shares the host's runtime, then loading it via a real
runtime `import(url)` (bundlers leave a non-statically-analyzable specifier
alone; the JS engine resolves it at runtime, same as it would under any other
bundler or no bundler at all — this is not a reason to move off Vite/Tauri).

This needs a small spike to confirm the mechanism actually works cleanly
inside the Tauri webview before the client registry is rebuilt on top of it.
Not yet done.

## Tool policy: no shell, by design

Gizmo already deliberately excludes Pi's default `bash` tool. The explicit
allowlist passed to `createAgentSession` in
`apps/agent-server/src/sessions/pi-agent-service.ts` is:

```ts
tools: [
	'read',
	'edit',
	'write',
	'git_status',
	'run_script',
	...activeDomains.tools.map(({ name }) => name),
],
```

Pi's default four tools are `read`, `write`, `edit`, `bash`. Gizmo keeps the
first three, adds `git_status` and `run_script`, and adds whatever narrow,
purpose-built tools each active extension contributes (Unity's `unity_*`
tools, which wrap its own RPC bridge — never raw shell). There is no
general-purpose _shell_, and that is intentional: it bounds what the model
can do to file edits, plus running one named script file, plus whatever an
extension explicitly and narrowly exposed.

This is a deliberate, load-bearing design choice, not an oversight to
"fix" by re-adding `bash`. It should stay this way.

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
wants to ship skills should ride this existing Pi mechanism — e.g. by
resolving to a skills directory the extension's own package declares, added
to `additionalSkillPaths` — rather than Gizmo inventing a parallel `skillsPath`
convention and a second resource-discovery system. Not yet wired up.

Pi's own "Extensions" concept (a TypeScript module with a
`(pi: ExtensionAPI) => ...` default export, registering providers, commands,
or TUI customization) is a different, adjacent thing from a
`GizmoServerExtension` — it extends Pi's own agent runtime, not Gizmo's
workspace/UI layer. Gizmo disables ambient Pi extensions
(`noExtensions: true`) and does not currently expose this to Gizmo
extensions. Whether/how to bridge the two is an open question, not a
decision made yet.

## Summary: what's implemented vs. planned

**Implemented:**

- Unified `GizmoServerExtension` / `GizmoWebExtension` contracts, no
  domain/extension split.
- Server-side runtime discovery via `gizmo.extensions.json` + dynamic
  `import()`, with graceful fallback.
- `bash` excluded from the default tool allowlist.
- `run_script` (Bun, `.ts`/`.js` only, no shell) as the sole additional
  execution primitive.

**Decided, not yet implemented:**

- Client-side runtime discovery (needs a Tauri/Vite dynamic-`import(url)`
  spike first).
- Skills/prompts distributed through Pi packages, wired via
  `additionalSkillPaths`, not a parallel Gizmo skill system.

**Open:**

- Whether a Gizmo-specific manifest (declaring an extension's capabilities
  before its code is executed, mirroring Pi's `pi` package.json key) is worth
  adding once there's a real third-party ecosystem to protect against.
- Whether/how Pi's own "Extensions" concept composes with
  `GizmoServerExtension`.
