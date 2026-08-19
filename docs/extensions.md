# Project extensions

Project extensions add optional Unity Editor integrations without adding their
payloads or state to the core app protocol.

## Boundary

Core owns three operations:

1. Discover installed extensions through `gizmo_extensions`.
2. Validate an invocation against the discovered operation descriptor.
3. Forward an opaque payload through `gizmo_extension_invoke`.

An extension descriptor has a stable ID, display name, semantic package
version, host API version, capabilities, and declared operations. Each operation
declares whether it mutates state and whether it requires confirmation. The
server rejects unknown extensions, unknown operations, and unconfirmed guarded
operations before invoking Unity.

The protocol deliberately does not define extension payload schemas. A web
extension owns its payload validation, state, polling, inspector contributions,
and presentation. Core only renders registered contributions.

## Adding an extension

Unity-side code registers a descriptor and operation handler behind the two
generic Pipeline commands. It must keep read operations side-effect free and
mark mutating operations accurately. Guarded operations accept
`confirmed: true` in their JSON input and must enforce that again inside Unity.

Web-side code implements `WebExtensionDefinition` under
`apps/app/src/lib/extensions/` and registers it in the extension registry. Its
ID and API version must match the Unity descriptor. The definition may create
inspector tabs and owns the lifetime of any polling or subscriptions it starts.

Neither `UnityProjectService`, `AgentStore`, nor `UnityInspector` should gain
extension-specific fields or branches when a new extension is added.
