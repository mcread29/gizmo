# Work log

## 2026-08-17 — Milestones 1–3

Established the project foundation and initial interface:

- Created a pnpm monorepo with the Svelte app, agent server, shared protocol, Unity tools, and design packages.
- Added root formatting, type-checking, testing, build scripts, and CI verification.
- Built the responsive three-pane agent workspace with session navigation, conversation and tool-call states, a composer, and Unity Editor inspector.
- Added app-owned wrappers for Bits UI buttons, dialogs, menus, selects, tabs, tooltips, and scroll areas, plus an accessible toast component.
- Implemented global data-attribute styling, shared design tokens, light and dark themes, responsive drawers, and a component gallery.
- Added structural and accessibility tests and reviewed the UI at desktop and mobile viewport sizes.

Verification completed successfully:

```text
pnpm format:check
pnpm check
pnpm test
pnpm build
pnpm peers check
```

The next planned milestone is the transport-independent agent client and versioned frontend/backend protocol.
