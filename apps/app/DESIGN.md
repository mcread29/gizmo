---
name: Gizmo
description: A quiet, capable workspace for browser-based AI coding
colors:
  canvas: '#f3f4ef'
  surface: '#fafbf7'
  surface-raised: '#ffffff'
  surface-soft: '#eef0e8'
  border: '#dfe2d7'
  border-strong: '#c9cec0'
  text: '#20231c'
  text-muted: '#6c7264'
  accent: '#c43f26'
  accent-hover: '#bd402a'
  accent-soft: '#f8e4de'
  on-accent: '#ffffff'
typography:
  body:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: 1
  mono:
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, monospace'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: '4px'
  sm: '6px'
  md: '10px'
  lg: '16px'
  full: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  2xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-accent}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    height: '36px'
    padding: '0 14px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.text-muted}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    height: '36px'
    padding: '0 14px'
---

# Design System: Gizmo

## Overview

**Creative North Star: "Quiet Workbench"**

Gizmo is a focused, capable workspace whose interface recedes behind the current coding task. Its visual system is compact rather than cramped, with familiar controls and enough operational detail to inspire confidence without turning into an IDE cockpit.

Depth is layered and restrained. Tonal surfaces establish structure; crisp borders and small ambient shadows clarify transient or raised elements. The system avoids consumer-chatbot playfulness, overloaded developer-tool density, and generic SaaS dashboard composition.

**Key Characteristics:**

- Restrained accent use for action and selection
- Compact, legible controls with visible keyboard focus
- Tonal hierarchy before elevation
- Consistent light, dark, and named theme roles

## Colors

The default palette uses soft mineral neutrals and a sparing ember accent. All alternate themes preserve the same semantic roles from `packages/design/src/tokens.css`.

### Primary

- **Workbench Ember** (`#c43f26`): Primary actions, active selections, links, and focus identity. Darkened from `#d54f35` to clear 4.5:1 contrast on raised surfaces for normal-size text.
- **Soft Ember** (`#f8e4de`): Low-emphasis selected and informational surfaces.

### Neutral

- **Canvas** (`#f3f4ef`): App background.
- **Working Surface** (`#fafbf7`): Standard panels and content regions.
- **Raised Surface** (`#ffffff`): Composer, dialogs, menus, and emphasized controls.
- **Soft Surface** (`#eef0e8`): Hover states, secondary regions, and compact chips.
- **Workbench Ink** (`#20231c`): Primary text.
- **Muted Ink** (`#6c7264`): Supporting labels and metadata.

**The One-Accent Rule.** Accent color communicates action, focus, or selection; it is not decoration.

## Typography

**Display Font:** Inter with system sans fallbacks  
**Body Font:** Inter with system sans fallbacks  
**Label/Mono Font:** SFMono-Regular, Consolas, Liberation Mono

**Character:** A compact sans hierarchy keeps the application calm and operational. Monospace is reserved for code, paths, shortcuts, identifiers, and technical metadata.

### Hierarchy

- **Title** (650, `1rem`–`1.125rem`): Dialog and section titles.
- **Body** (400, `0.875rem`, 1.5): Conversation and application copy.
- **Label** (600, `0.8125rem`, 1): Controls and concise actions.
- **Metadata** (400–500, `0.6875rem`–`0.75rem`): Supporting state; 11px is the absolute floor.

## Layout

The application uses a persistent workspace shell around a conversation column capped at `780px`. Spacing follows a 4px base rhythm, with compact controls and larger 20–32px separation between regions. Side panels switch between docked and overlay modes; the main task remains visually central.

## Elevation & Depth

Tonal layering carries most hierarchy. `--shadow-sm` provides restrained local separation, `--shadow-panel` lifts the composer and floating controls, and `--shadow-md` is reserved for dialogs and major overlays. Focus uses a semantic 3px accent ring rather than a generic shadow.

**The Layer-First Rule.** Choose a semantic surface and border before adding elevation; shadows identify genuinely raised or transient UI.

## Shapes

Corners range from 4px for small technical elements to 16px for dialogs. Standard controls use 6px; contained regions use 10px. Full pills are limited to badges, compact status controls, and circular actions. Borders remain crisp and usually one pixel.

## Components

### Buttons

- **Shape:** 6px radius with 30px, 34px, or 36px control sizing.
- **Primary:** Ember fill with white text; reserved for the leading action.
- **Secondary:** Raised surface with a neutral border.
- **Ghost:** Transparent and muted at rest, soft surface on hover.
- **Focus / Active:** Visible accent ring; active controls translate down 1px.

### Chips

- **Style:** Compact soft or raised surfaces, subtle borders, and ellipsis for long technical names.
- **State:** Accent is used only when selection needs to be unmistakable.

### Cards / Containers

- **Corner Style:** 10px standard, 16px for major overlays.
- **Background:** Semantic surface layers rather than independent decorative cards.
- **Shadow Strategy:** Flat by default; elevation only when spatially raised.
- **Internal Padding:** 12–24px according to density and hierarchy.

### Inputs / Fields

- **Style:** Neutral border, raised or transparent surface, 6px radius.
- **Focus:** Accent border plus a 3px soft accent ring.
- **Disabled:** Reduced opacity with interaction removed.

### Navigation

Navigation is compact, text-forward, and structurally aligned with the workspace shell. Hover uses a soft surface; active state adds stronger text and surface contrast without decorative markers.

## Do's and Don'ts

### Do:

- **Do** keep commands and advanced capabilities progressively discoverable.
- **Do** use existing semantic color, spacing, radius, and type tokens.
- **Do** preserve keyboard navigation, visible focus, and reduced-motion behavior.
- **Do** prioritize the current thread and workspace over surrounding chrome.

### Don't:

- **Don't** style the product as a playful consumer chatbot.
- **Don't** expose every capability permanently or compress controls below the 11px type floor.
- **Don't** create decorative card grids or marketing-dashboard chrome.
- **Don't** use accent color or shadow without communicating state or spatial hierarchy.
