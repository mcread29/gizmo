# Settings: what is wrong and what to do about it

A proposal, written after rebuilding the Providers page. Providers was the
worst case, but nothing about it was unique — every defect it had is somewhere
else in Settings too. This is the list, with the evidence, and the order to fix
it in.

The short version: Settings is not badly styled. It is badly _structured_, and
the styling is a series of local repairs for that. Nine pages were each given a
plausible-looking layout without anyone deciding what a settings page _is_, so
the shared parts drifted into contradiction and every page pays a little tax to
paper over it. That accumulation is the thing that reads as machine-made.

## The six defects

### 1. The navigation groups are wrong, and every page apologizes for it

`SettingsScreen.svelte:82` puts seven items under **This device**: Appearance,
Chat, Context, Memory, Connection, Providers, Agent resources. Three of them
are not device settings. Their own subtitles say so:

| Page            | Its own `scope` line                                 |
| --------------- | ---------------------------------------------------- |
| Providers       | "Model credentials, stored by Gizmo on this machine" |
| Agent resources | "Applies to every workspace on this machine"         |
| Memory          | "Digests are derived from this workspace's journal…" |

`SettingsPage.svelte:6` is candid about why that subtitle exists at all:

> Who the page's settings apply to. Stated on every page because the screen
> mixes device preferences with machine-wide agent configuration.

So a required prop on every page exists to correct a mis-grouping in the nav.
Fix the grouping and most of the prop's reason to exist goes away.

**Do:** three groups that are true — **This device** (Appearance, Chat,
Context, Connection), **This machine** (Providers, Agent resources), **This
workspace** (Memory) — and demote `scope` from required to optional, for the
pages that genuinely have something more to say than their group already says.

### 2. The card primitive is cancelled by the pages that use it most

`settings-card` is a bordered, rounded surface (`layout.css:203`). Then
`layout.css:211` strips the border, the radius and the background back off for
the Agent and Extensions pages, and `layout.css:221` puts borders back on the
inner lists instead. The comment is honest about it: "Resource pages are work
surfaces, not stacks of cards."

That is correct, and it means there are two page archetypes fighting over one
primitive:

- **Preference pages** (Appearance, Chat, Context, Connection, About) — a short
  stack of independent settings. Cards group them.
- **Inventory pages** (Providers, Skills, Extensions, Agent resources, Memory) —
  one long list of many similar things. Cards are pure overhead; what they need
  is a full-width scannable list with a header row.

**Do:** name both. Keep `settings-card` for preference pages only, and add a
`settings-list` surface for inventory pages — the border and header that the
new `provider-table` already demonstrates. Delete the page-scoped un-styling in
`layout.css:211-232`, which becomes unnecessary once the inventory pages stop
asking for a card.

### 3. There is exactly one real heading in the whole screen

- `SettingsScreen.svelte:124` — `<h1>` Settings, deliberately screen-reader only
- `SettingsPage.svelte:30` — `<h2>` the page title
- everything below that is `<strong>`: `settings-subhead` (`layout.css:180`,
  five uses) and `settings-section-header` (`controls.css:57`)

No page in Settings has an `h3`. A screen-reader user can reach the page and
then has no way to jump within it, and visually the sections carry no more
weight than the label of a single switch, because they are the same element at
nearly the same size.

**Do:** `settings-subhead` renders an `h3`. One rule, five call sites, no
visual change required beyond the weight it should have had.

### 4. Dead code that the lint gate cannot see

`SettingsSection.svelte` has zero importers, and its surface rule
(`skill-editor.css:218`) is a byte-for-byte copy of `settings-card`. That rule
survives `check:hooks` only because the checker looks for `data-ui` attributes
in markup, and unreachable markup still counts. (The header rules underneath it
are not dead: `settings-section-header` has three live uses.) `settings-hint`
is the mirror image: used once (`ChatSettings.svelte:61`) and matched by no CSS
rule anywhere — a bare `<p>` wearing a system part's name.

**Do:** delete `SettingsSection.svelte` and the dead surface rule; give the
lone `settings-hint` paragraph to the field it explains, as that field's
description. Consider extending `check-ui-hooks.mjs` to also flag
hooks used in markup but never styled, which would have caught `settings-hint`
the day it was written.

### 5. Two field components with opposite contracts

`SwitchField` renders the entire row — the `setting-field`, the label, the
description, the control. `SelectField` renders a bare trigger whose only label
is an `aria-label`. Same family, same page, opposite responsibilities. The
consequences are visible:

- `AppearanceSettings.svelte:45` hand-builds a `setting-field` around a
  `SelectField` and labels it twice — a visible `<strong>Color scheme</strong>`
  and `aria-label="Color scheme"` on the trigger.
- `ChatSettings.svelte:54` puts the same component alone in a card with **no
  visible label at all**. The user sees a dropdown, a value, and a paragraph
  after it; nothing on screen says what it sets. It is the clearest single
  usability bug in Settings.

**Do:** one `SettingField` wrapper that owns the row — label, optional
description, optional disabled state — and takes the control as a snippet.
`SwitchField` becomes a thin caller of it rather than a second implementation
of it; `SelectField` stays a bare control, which is right, because extensions
use it outside Settings too. Then Chat's thread-name select gets its label back
for free.

### 6. Prose where a value would do

Every setting is a full-width row with a bold title and a sentence of
explanation, at the same weight, forever. Chat's three switches take as much
vertical space as forty providers used to, and the descriptions are written to
fill the slot rather than because each setting needs a sentence.

**Do:** treat the description as optional and earn it. "Send with Enter" needs
its second line ("press Shift+Enter for a new line"); "Follow agent output"
does not. Rows without a description collapse to a single line, which is where
the density comes from.

## Order of work

1. **Shared fixes** (~1 change each, no page rewrites) — the nav groups, `scope`
   becoming optional, `settings-subhead` as `h3`, deleting `SettingsSection`,
   `settings-hint` → `ResourceNote`. Mechanical and independently shippable.
2. **`SettingField`** — introduce the wrapper, move `SwitchField` onto it, fix
   Chat's unlabelled select. Touches five pages, all of them shallowly.
3. **`settings-list`** — lift the surface out of the new `provider-table` and
   move Extensions and Agent resources onto it, then delete the page-scoped
   card un-styling.
4. **Density pass, page by page** — drop the descriptions that say nothing, in
   the order the pages are actually used.

Each step leaves the screen in a shippable state. None of them requires a
visual redesign: the tokens, the type scale and the colour system are fine. The
problem was never how it looks — it is that nine pages each invented their own
answer to the same three questions, and the CSS has been arbitrating ever since.

## What shipped

All four steps, in that order.

**Providers** (`ProvidersSettings.svelte`, `styles/settings-parts/providers.css`)
is defect 6 taken to its conclusion: a real table at 34px a row instead of a
62px stacked form per provider, column headers that name the fields once
instead of per-row labels, and icon actions that appear only when they apply —
Save on the first keystroke, Copy and Remove only once a key is stored.

**Nav and scope** (defect 1). Four groups that are true: This device, This
machine, This workspace, Gizmo. `scope` is optional now, and seven pages
dropped theirs because their group already said it. The three that kept one
say something their group cannot: Context's "new and resumed threads",
Extensions' per-workspace override, Memory's rebuildable digests.

**`SettingField`** (defect 5) owns the row — label, optional description,
optional `stacked` and `disabled` — and takes the control as a snippet.
`SwitchField` is now nine lines of delegation to it; Appearance, Connection,
About, Context, Memory and Providers gave up their hand-built copies; and
Chat's thread-name select has a visible label for the first time. Its
`detail` snippet is the one escape hatch, for Memory's coverage line, which
changes while a backfill runs.

**`settings-list`** (defect 2) is the inventory surface: a grid with a rule
above and below and nothing else. Extensions' installed list and the Agent
page's Built-in tools and Prompts lists use it, and the per-page card
un-styling in `layout.css` is gone. Two surfaces that were caught by that
blanket rule — the Agent page's Warnings and the extension registry — are
cards again, which is what they always were.

**Headings** (defect 3). `settings-subhead` and `settings-section-header`
render `h3`. Nine of them, across Agent, Extensions, About, Memory,
Instructions and the workspace Configure screen.

**Density** (defect 6). Rows without a description collapse to 44px instead of
62px. "Color scheme", "Light and dark" and "Follow agent output" lost sentences
that only restated their label.

Two shared defects Providers depended on were fixed along the way:

- `settings-page-header` now wraps, so a page's actions drop below the title
  instead of crushing it at narrow widths.
- `setting-field > [data-ui='button']` no longer shrinks, which was letting the
  "Refresh Pi auth" button overlap its own description.

Still open: `check-ui-hooks.mjs` only catches styled hooks with no markup. The
inverse — `settings-hint`, a markup hook no rule ever matched — went unnoticed
for as long as it existed.
