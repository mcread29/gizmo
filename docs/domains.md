# Workspace domains

Gizmo's core is a general coding workbench. A workspace domain teaches it how
to recognize and work with a particular project ecosystem, such as Unity or
Svelte. Domains are bundled integrations selected from the workspace contents;
they are separate from the smaller project-side extensions described in
[extensions.md](extensions.md).

## Boundary

Core owns sessions, messages, coding tools, Git, files, models, layout, and the
extension lifecycle. A domain owns:

- workspace detection;
- domain-specific system instructions;
- domain tools and confirmations;
- inspector UI, dialogs, and settings; and
- adapters to an external runtime such as the Unity Editor.

Projects are added explicitly and stored in `projects.json` with one selected
domain. Detection suggests only compatible specialized domains, while Generic
is always available. New and resumed threads activate the stored selection, so
the same folder is not reinterpreted differently between sessions.

Core coding and Git tools are always available and are not repeated by domains.

```text
workspace folder
      │
      ▼
domain registry ── detect/select ──┬─ Unity: Editor tools + prompt
                                  ├─ Svelte: conventions + inspector
                                  └─ Generic: Pi defaults
      │
      ├─ composed Pi session
      └─ contributed web UI
```

## Server contract

Server domains implement `WorkspaceDomain` in
`apps/agent-server/src/domains/types.ts`:

```ts
interface WorkspaceDomain {
	id: string;
	name: string;
	detect(workspacePath: string): Promise<boolean>;
	systemPrompt: string;
	createTools(context: DomainContext): ToolDefinition[];
}
```

Detection must be local, deterministic, and cheap. A domain receives only the
selected workspace and the generic confirmation callback. It must not modify
global agent policy. Register bundled domains in `domains/registry.ts`.

## Web contract

The web domain registry turns active domain IDs into a generic `WorkspaceView`
and contributions. `App.svelte`, the title bar, and the shell render that
contract; they do not import Unity components or interpret Unity status.

Domain components live under `apps/app/src/lib/domains/` (or a domain-owned
feature directory while code is migrated). They may contribute the inspector,
dialogs, and settings. Keep runtime-specific state and polling behind that
boundary.

The new-thread dialog accepts any folder, detects compatible domains, and stores
the user's selection. The desktop build uses a native folder picker; browser
development accepts an absolute path. Stored projects appear in the dialog on
later launches. The server announces the active domain ID with the
session-created event.

The project manager can change a stored project's domain or remove it from
Gizmo. Removal does not touch project files or existing threads. The thread
sidebar groups sessions by project, sorted by project name, while keeping each
project's threads in most-recent-first order.

## Included domains

### Unity

Detected by `ProjectSettings/`. It contributes Unity CLI/Pipeline tools, the
Editor lifecycle prompt, Editor inspector, Play Mode compile confirmation, and
Unity-hosted project extensions such as Console.

### Svelte

Detected when `package.json` declares `svelte` in dependencies or development
dependencies. It contributes Svelte-specific working guidance and a lightweight
changes/activity inspector. It intentionally has no custom tools yet; normal
coding and project scripts already cover the useful baseline.

### Generic

Available for every folder. It contributes no prompt override or custom tools,
which deliberately preserves Pi's normal default coding-agent prompt and tool
behavior.

## Adding a domain

1. Add detection, prompt, and tools in a server domain directory.
2. Register it in the server registry.
3. Add its web view and contribution components to the web domain registry.
4. Add one focused detection/composition test and tests for any custom tools.
5. Keep protocol payloads generic. If a new contribution requires a host
   capability, design a reusable slot rather than adding a product-specific
   request to core.

The current Unity project transport predates this boundary and remains as a
compatibility adapter for Editor status and embedded project extensions. New
domains must not add parallel hard-coded request families; the next transport
revision should replace that adapter with opaque domain operations.
