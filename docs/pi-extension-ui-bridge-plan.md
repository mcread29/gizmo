# Pi Extension UI Bridge Plan

## Status

In progress. The first functional bridge milestone is implemented:

- Pi extensions run with a browser-backed, UI-capable context in Pi Web mode.
- Select, confirm, input, and multi-line editor requests round-trip through Gizmo.
- Notifications, status entries, text widgets, document titles, composer text, and working-state overrides render in the existing shell.
- Requests are session- and runtime-scoped, with timeout, abort, reload, eviction, deletion, and disconnect cleanup.
- Protocol, server runtime, frontend state, component, and end-to-end tests cover the bridge.

Remaining phases include extension attribution in Pi, complete theme and synchronous editor/tool-state mapping, richer compatibility rendering, the public browser component SDK, custom frontend pairing, and migration of existing Gizmo extensions.

This document is the stable implementation plan for bringing Pi extension UI into Gizmo. It describes the intended product and architecture without prescribing low-level implementation details.

## Decisions

Two direction-setting decisions are made:

1. **Gizmo extensions become UI-only.** Pi extensions own all agent
   capabilities — tools, commands, hooks, providers, state. A Gizmo extension
   shrinks to a pure Svelte web bundle paired with a Pi extension by id,
   contributing presentation: richer renderings of bridge UI requests,
   inspector tabs, panels, and purpose-built views. The
   `GizmoServerExtension` capabilities that duplicate Pi (`createTools`,
   `systemPrompt`, `profile`, server-side `list`/`invoke`) are retired once
   every backend has migrated; `createProjectService` process management
   moves inside the owning Pi extension module.

2. **The events protocol is the Gizmo UI contract.** Pi extensions that want
   rich UI publish versioned declarative views (the `pi-declarative-ui`
   model already proven in Pi's TUI: view state as widget lines, validated
   action routing back). The generic `ctx.ui` bridge remains the universal
   fallback renderer, so an extension without a Gizmo bundle still works
   (Principle 4). A future `extension.invoke` protocol message may replace
   the events channel for request/response operations beyond view/action.

Migration order follows the phases below: attribution first, then the events
contract, then the extensions whose Pi backends already exist (ask-user,
subagents, workflows), then Git/Activity/Svelte, then Unity last. Built-in
tool availability is no longer a Gizmo policy: it is Pi's `defaultTools`
setting, seeded to `read`/`edit`/`write` and editable globally and per
workspace (see `docs/extensions.md`).

## Objective

Make existing Pi extensions feel native in Gizmo by implementing Pi's extension UI capabilities as browser interfaces.

This is the first step toward making Pi extensions the backend foundation for Gizmo extensions. Pi will continue to own extension behavior, tools, commands, hooks, resources, state, and lifecycle. Gizmo will provide the browser presentation and user interaction layer.

A Pi extension should remain useful without a custom Gizmo frontend. An optional custom frontend may later enhance the extension with richer, purpose-built browser UI.

## Guiding principles

1. **Pi remains the source of truth.** Gizmo adapts Pi extension UI requests rather than creating a parallel behavioral extension system.
2. **Existing extensions should work without modification.** Standard `ctx.ui` calls should produce native Gizmo interfaces wherever practical.
3. **Use semantic web UI, not terminal emulation.** Browser interfaces should follow Gizmo's design system, accessibility model, and responsive layout.
4. **Custom frontends are optional enhancements.** Missing or broken browser UI must not disable an extension's tools, commands, hooks, or resources.
5. **UI is scoped to the active extension runtime.** Reloading, replacing, or closing a session must clean up that runtime's dialogs and persistent UI.
6. **Unsupported terminal features degrade explicitly and safely.** Gizmo should not silently pretend that a terminal-only interaction succeeded.
7. **The bridge should be general.** It should support user-installed Pi extensions, not only first-party Gizmo packages.

## High-level architecture

Gizmo will keep its existing in-process Pi SDK sessions and WebSocket application protocol. It will not switch to a Pi subprocess, `InteractiveMode`, or the full Pi RPC runtime.

When a Pi extension calls a UI method, the interaction will flow through the existing Gizmo client/server boundary:

```text
Pi extension
    │
    │ ctx.ui.select(), confirm(), notify(), setStatus(), ...
    ▼
Session-scoped Gizmo UI context
    ▼
Agent server protocol
    ▼
Frontend extension UI store
    ▼
Native Svelte component
    │
    │ user response, when required
    ▼
Agent server
    ▼
Original Pi extension call resolves
```

Pi extensions will be bound in a UI-capable headless mode using a Gizmo-provided UI context. This gives extensions a real UI without replacing Gizmo's session service or application shell.

## UI capability groups

### 1. Interactive dialogs

Gizmo will provide native browser interfaces for:

- Selection dialogs
- Confirmation dialogs
- Single-line input
- Multi-line editing
- Cancellation
- Timeouts and countdowns
- Abort signals
- Keyboard navigation
- Focus trapping and restoration

These interactions pause the calling extension until the user responds, cancels, the operation times out, or the session runtime is disposed.

Only one blocking extension interaction should hold primary focus at a time. Additional requests should be queued or presented through a deliberate stacking policy.

### 2. Notifications and persistent interface state

Gizmo will support Pi extension requests for:

- Notifications and warnings
- Status entries
- Widgets above or below the composer
- Window or document titles
- Working messages and indicators
- Working-state visibility
- Tool-call expansion state

Persistent contributions will be keyed by session and extension so one extension cannot accidentally overwrite another extension's UI.

### 3. Composer interaction

Where Pi extensions interact with the editor, Gizmo will connect those operations to its existing composer:

- Set composer text
- Read composer text
- Paste into the composer
- Preserve normal draft behavior
- Preserve attachment and input handling
- Restore focus appropriately

These operations must respect the currently active thread and must not modify a different thread's draft after a session switch.

### 4. Themes

Gizmo will expose meaningful browser equivalents for Pi theme operations where practical:

- List available themes
- Read the current theme
- Switch themes
- Report unsupported theme requests clearly

Pi terminal themes and Gizmo browser themes do not have identical rendering models. Theme support will therefore map semantic intent rather than reproduce terminal color cells exactly.

### 5. Widgets and simple rendered content

Text-based Pi widgets will render as native Gizmo UI using the existing typography, spacing, and color tokens.

Simple terminal-rendered content may receive a compatibility presentation when it can be represented safely as text or formatted lines. It should not introduce a terminal emulator into the application.

### 6. Rich custom UI

Pi's TUI component factories and `ctx.ui.custom()` receive terminal-specific objects, input handling, focus management, and cell-based rendering. They cannot be translated directly into Svelte components.

The initial bridge will therefore treat interactive terminal-only custom components as unsupported, consistent with Pi's existing headless behavior. Gizmo should return the appropriate cancelled or unavailable result and may show a restrained explanation to the user.

Rich browser interfaces will instead be supported through an optional web extension layer. A Pi extension package will be able to ship a custom Gizmo frontend that uses browser-native components while keeping the Pi extension as its backend.

## Browser extension UI library

Gizmo will provide a stable, versioned browser component library for custom extension frontends. The library should cover the same broad product needs as Pi's TUI package while using web-native semantics.

Expected component categories include:

### Layout

- Stacks and rows
- Panels and sections
- Dividers
- Scroll areas
- Overlays and dialogs
- Tabs

### Content

- Text and Markdown
- Code and diffs
- Icons and badges
- Keyboard hints
- Empty states
- Tool-result presentation

### Input

- Buttons
- Text inputs and text areas
- Selectors
- Checkboxes and toggles
- Settings lists
- Form validation

### Feedback

- Loaders
- Progress indicators
- Alerts
- Notifications
- Error and diagnostic states

The component library will use Gizmo's semantic tokens and accessibility conventions. Extensions should not depend directly on private application styles or broad internal stores.

## Extension identity and attribution

Every UI request must be attributable to the Pi extension that created it.

Attribution is needed for:

- Isolating status and widget keys
- Cleaning up state after reload
- Showing users which extension requested an interaction
- Applying trust and permission policy
- Diagnosing extension failures
- Matching a Pi backend with an optional browser frontend

Pi currently supplies one shared UI context to an extension runtime. The bridge may therefore require a small Pi SDK enhancement so the host can receive the calling extension's path and canonical `sourceInfo` with each UI operation.

The bridge should use Pi's source metadata as canonical provenance rather than guessing ownership from tool or command names.

## Session and lifecycle behavior

Extension UI belongs to a specific Pi session runtime.

When that runtime is reloaded, replaced, switched, forked, disconnected, deleted, or shut down, Gizmo will:

- Cancel unresolved dialogs
- Resolve pending extension calls with safe cancellation values
- Clear statuses, widgets, and working-state overrides
- Dispose browser components and subscriptions
- Ignore responses belonging to the stale runtime
- Rebuild state only from the new extension runtime

Short-lived notifications may remain visible as ordinary toasts, but no interactive or persistent contribution may leak into another runtime.

## Trust and security

Pi extensions run with the user's system permissions. The UI bridge does not make them sandboxed.

Gizmo will nevertheless preserve clear trust boundaries:

- Project-local extension UI is available only when Pi considers the project trusted.
- Dialogs should identify their owning extension where useful.
- Sensitive input should use an appropriate private or secret-input path.
- Destructive actions should use host-mediated confirmation rather than trusting an extension-provided `confirmed` field.
- Browser bundles for custom frontends receive the same installation and trust scrutiny as their Pi backend packages.
- Runtime-loaded browser code must be treated as privileged application code unless a future sandbox is introduced.

## Protocol responsibilities

The Gizmo protocol will gain session-scoped extension UI messages for:

- Opening an interactive request
- Returning a user response
- Updating or clearing persistent UI
- Cancelling requests
- Cleaning up a runtime

Requests and responses will carry stable IDs. Responses for stale, unknown, or already-resolved requests will be rejected or ignored safely.

The protocol should carry semantic data, not Svelte components or terminal rendering objects.

## Frontend state and placement

A dedicated extension UI store will manage dialogs, statuses, widgets, notifications, working state, and pending responses. It will remain separate from the core agent transcript state while integrating with the active session.

UI will be placed in existing Gizmo surfaces:

- Dialogs in the application dialog layer
- Notifications in the toast system
- Status contributions in the title or status area
- Widgets around the composer
- Editor operations in the existing composer
- Working-state contributions in the conversation streaming UI
- Custom web panels in supported extension slots

The bridge must preserve the current Gizmo shell rather than introducing a separate extension screen or terminal-like interface.

## Delivery phases

### Phase 1: Foundation

- Add extension attribution support where required.
- Introduce the session-scoped UI context.
- Add protocol request, response, cancellation, and cleanup messages.
- Add the frontend extension UI store.
- Bind Pi extensions in a UI-capable headless mode.

### Phase 2: Core dialogs

- Implement select, confirm, input, and multi-line editor interfaces.
- Add timeout, cancellation, abort, focus, and keyboard behavior.
- Verify calls resolve correctly during normal use and runtime disposal.

### Phase 3: Notifications and persistent UI

- Implement notifications, statuses, and text widgets.
- Connect working messages, indicators, and visibility.
- Add ownership display and per-extension cleanup.

### Phase 4: Composer and application state

- Implement set, get, and paste editor operations.
- Connect tool expansion state.
- Connect document titles and other applicable shell state.
- Ensure operations remain scoped to the correct thread.

### Phase 5: Theme mapping

- Expose Gizmo's theme catalog through the bridge.
- Map compatible Pi theme operations to browser themes.
- Define explicit fallback behavior for incompatible terminal themes.

### Phase 6: Compatibility rendering

- Render text widgets and simple formatted output natively.
- Add safe fallbacks for unsupported terminal component factories.
- Document the boundary between browser-supported and terminal-only interfaces.

### Phase 7: Browser component SDK

- Publish a stable extension UI component library.
- Define supported extension slots and a narrow host API.
- Add versioning and compatibility checks.
- Provide examples for dialogs, inspector panels, settings, status, and tool results.

### Phase 8: Custom frontend pairing

- Allow a Pi package to advertise an optional Gizmo browser bundle.
- Match browser bundles to active Pi extensions using canonical provenance and explicit identity.
- Activate and dispose custom frontends with the owning Pi session runtime.
- Ensure extensions continue to work when the browser bundle is absent or fails.
- Carry the declarative events contract: view state flows extension → browser, validated actions flow browser → extension runtime.

### Phase 9: Gizmo extension migration

After the generic bridge is established:

- Convert first-party Gizmo backends into normal Pi extensions.
- Keep their existing frontend panels as optional browser companions.
- Migrate the UI-first extensions whose Pi backends already exist (ask-user,
  subagents, workflows) before touching anything with server state.
- Use Git as the first migration and validation case.
- Migrate Unity, Svelte, activity, and skill-authoring according to whether each needs a backend or belongs in core UI; Unity's project-service process management moves inside its Pi extension module.
- Retire duplicate Gizmo server-extension behavior when equivalent Pi-backed paths are complete.

## Testing strategy

The bridge should be tested at four levels:

1. **UI context tests:** every Pi UI method produces the correct semantic request and safe fallback.
2. **Protocol tests:** requests, responses, timeouts, cancellation, and stale-runtime handling validate correctly.
3. **Component tests:** keyboard behavior, focus, accessibility, responsive layout, and error states.
4. **End-to-end extension tests:** real Pi extensions request UI, receive user responses, survive reload, and clean up after session replacement.

Test fixtures should include concurrent requests, extension errors, disconnects, timeouts, project trust changes, and stale responses after reload.

## Initial definition of success

The first major milestone is complete when a typical existing Pi extension can run in Gizmo and successfully use:

- `select`
- `confirm`
- `input`
- `editor`
- `notify`
- `setStatus`
- Text-based `setWidget`
- Composer text operations
- Working-state operations

The interaction must feel native to Gizmo, remain accessible by keyboard, and clean up correctly across reload and session changes.

The broader milestone is complete when Pi extension packages can optionally ship rich browser companions using a stable Gizmo component SDK, without moving their backend behavior out of Pi.

## Non-goals

This plan does not include:

- Replacing Gizmo's application shell with Pi's terminal UI
- Running Pi through a subprocess solely to use RPC mode
- Rendering arbitrary Svelte code supplied through `ctx.ui.custom()`
- Perfectly reproducing terminal cell rendering in the browser
- Treating browser bundles as a replacement for Pi extension behavior
- Migrating every existing Gizmo extension before the generic bridge is proven

## Long-term outcome

Pi extensions become the universal backend extension model. Gizmo supplies two frontend layers:

1. A generic browser implementation of nearly all semantic Pi UI capabilities.
2. An optional rich browser component system for extensions that want a tailored interface.

This preserves compatibility with the Pi ecosystem while allowing Gizmo extensions to provide interfaces that feel fully integrated with the existing workspace, conversation, settings, and inspector experience.
