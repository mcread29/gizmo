# Project extensions

Project extensions add optional Unity Editor integrations without teaching the
Gizmo core about their data or behavior. Core discovers extensions, validates
their declared operations, forwards opaque payloads, and renders generic UI
contributions. Each extension owns everything else.

The first implementation is `com.gizmo.extras.console` in the Cronkis embedded
`com.gizmo.extras` package.

## Architecture

```text
Unity package                  Agent server                  Web app
─────────────                  ────────────                  ───────
extension registry     →       discover descriptors   →     extension registry
operation handlers     ←       validate + forward     ←     extension runtime
Unity-specific data            opaque JSON payloads          state + UI + polling
```

There are two Unity Pipeline entrypoints for every extension:

- `gizmo_extensions` returns installed extension descriptors.
- `gizmo_extension_invoke` invokes one declared operation with JSON input.

There are no extension-specific requests, events, store fields, or branches in
core. Adding an extension must not require changes to `UnityProjectService`,
`AgentStore`, or `UnityInspector`.

## Descriptor contract

Each installed extension returns a descriptor with this shape:

```json
{
	"id": "com.gizmo.extras.example",
	"name": "Example",
	"version": "0.1.0",
	"apiVersion": 1,
	"capabilities": ["example.inspect"],
	"operations": [
		{
			"id": "snapshot",
			"mutates": false,
			"requiresConfirmation": false
		},
		{
			"id": "apply",
			"mutates": true,
			"requiresConfirmation": true
		}
	]
}
```

- `id` is the permanent identity shared by the Unity and web implementations.
- `version` is the extension package version. It may change without changing
  the host contract.
- `apiVersion` is the web/Unity payload contract version. The web definition is
  activated only when it supports the exact version.
- `capabilities` describe meaningful features for compatibility and future
  composition. They do not grant invocation by themselves.
- `operations` are the invocation allow-list.
- `mutates` identifies operations that change project or Editor state.
- `requiresConfirmation` makes the server reject an invocation unless its JSON
  input contains `confirmed: true`.

The protocol validates descriptors but deliberately defines no extension
payload schemas. Payload validation belongs to the matching web and Unity
implementations.

## Discovery and lifecycle

When a thread selects a project, the app requests its extension descriptors.
The server first inspects the live Pipeline command list so a missing extension
host never generates a Unity Console error. Descriptors are cached briefly and
rechecked while the project is watched. Installation, removal, or an API-version
change therefore updates the active project without restarting Gizmo.

For every compatible descriptor, the web registry creates one runtime with a
project-scoped `ExtensionContext`:

```ts
interface ExtensionContext {
	projectPath: string;
	invoke(operation: string, input?: unknown): Promise<unknown>;
}
```

The context is already scoped to the descriptor ID. An extension cannot invoke
another extension by changing an argument.

A runtime may contribute inspector tabs. It owns the tabs' components, props,
badges, state, subscriptions, and polling. `dispose()` must synchronously stop
timers and subscriptions. Results arriving after disposal must be ignored.

## Adding a Unity extension

Register the extension behind the package's generic registry rather than adding
another `[CliCommand]`.

1. Choose a stable reverse-domain ID and API version.
2. Return a descriptor from `gizmo_extensions`.
3. Route declared operation IDs inside `gizmo_extension_invoke`.
4. Parse and validate JSON input inside the extension handler.
5. Return a small serializable object; do not require consumers to parse logs.
6. Keep read operations side-effect free.
7. Mark every state-changing operation as mutating.
8. Enforce confirmation again inside Unity for guarded operations. Server-side
   validation is defense in depth, not a replacement for the Unity guard.
9. Reject project-content writes during Play Mode, compilation, or domain
   reload.
10. Add focused command-contract and behavior tests.

The generic entrypoints must remain the only public Pipeline commands supplied
by the Extras package. Extension-specific command names recreate the coupling
this system exists to avoid.

## Adding a web extension

Create a directory under `apps/app/src/lib/extensions/` containing the
extension definition, runtime, components, payload parser, tests, and styles.
Register only its `WebExtensionDefinition` in `registry.ts`.

```ts
export const exampleExtension: WebExtensionDefinition = {
	id: 'com.gizmo.extras.example',
	apiVersion: 1,
	activate: (descriptor, context) => new ExampleRuntime(context),
};
```

The runtime should:

- validate every opaque response before storing or rendering it;
- keep extension state out of `AgentStore`;
- expose UI through generic contributions;
- deduplicate concurrent requests instead of queuing them;
- distinguish background work from user-triggered loading indicators;
- use revision or cursor probes before fetching large snapshots;
- stop all recurring work in `dispose()`;
- ignore results for a project that is no longer active.

Styles live with the extension. Global app styles should contain only generic
contribution-container behavior.

## Invocation and safety

Before forwarding an operation, the server verifies that:

1. the project is registered;
2. the extension is currently installed;
3. the operation appears in its descriptor; and
4. guarded operations received `confirmed: true`.

Unity must repeat input and confirmation checks at the actual mutation boundary.
An extension descriptor is not trusted authorization.

Keep payloads bounded. The WebSocket already has a global payload limit, but
extensions should return summaries, tails, or paginated data rather than entire
project databases. Polling extensions should make their cheap no-change path
truly cheap.

## Testing checklist

An extension should have focused coverage for:

- descriptor identity, API version, and operation metadata;
- malformed input and unknown operation rejection;
- confirmation omission for every guarded operation;
- payload parsing on the web side;
- activation only when the matching descriptor is installed;
- runtime disposal and request deduplication;
- background versus manual loading behavior; and
- the smallest live Unity invocation that proves registration.

After changing the Unity package, wait through compilation and domain reload,
check Editor errors, run its EditMode fixture, list the live commands, and invoke
the generic discovery and operation entrypoints.

## Current limitations

- Web implementations are bundled with Gizmo and registered at build time.
  Installing a Unity package activates a compatible bundled implementation; it
  cannot currently deliver arbitrary JavaScript to the app.
- Downloading, installing, updating, and removing the Extras Unity package is a
  separate distribution layer and is not implemented yet.
- Inspector tabs are the only contribution slot today. New generic slots should
  be added only when at least one extension needs them; they must not encode one
  extension's behavior into core.

See [extension-ideas.md](extension-ideas.md) for candidate extensions and the
criteria for deciding whether a feature belongs here.
