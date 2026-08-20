# Extension ideas

An extension is a good fit when it needs privileged Unity Editor APIs, benefits
from a persistent visual surface, and can remain optional. A one-shot operation
that an agent can already perform through a normal Pipeline command is usually
not worth an extension.

## Strong candidates

### Selection inspector

Mirror the active Unity selection with components, serialized fields, prefab
status, missing references, and asset links. Useful operations could select or
ping an object and apply a reviewed serialized-field edit.

This is a strong next example because it exercises bidirectional Editor state,
small snapshots, and confirmed mutations without needing high-frequency data.

### Test dashboard

Show EditMode and PlayMode fixtures, the latest result per fixture, durations,
failures, and source links. Operations could run a fixture, rerun failures, or
cancel an active run.

The extension would own asynchronous run state while the core app sees only an
inspector contribution and opaque operations.

### Scene validation

Run project-defined rules against open scenes and prefabs: missing references,
invalid layers, duplicate singleton components, forbidden dependencies, or
project-specific conventions. Show findings grouped by scene with links and
offer individually confirmed fixes.

This is especially useful because validation rules belong to the project or
package, not Gizmo core.

### Play Mode telemetry

Expose a bounded live view of frame time, memory, object counts, domain-specific
game metrics, and notable runtime events. Use cheap revision/cursor probes and
sample at an explicit frequency rather than streaming every frame.

The main design challenge is backpressure: the extension must aggregate inside
Unity and send small snapshots.

### Asset dependency explorer

Visualize direct and reverse dependencies for a selected scene, prefab,
material, shader, or ScriptableObject. Include bundle or Addressables ownership,
file size, and references that prevent deletion.

Read-only inspection is immediately useful; destructive cleanup should remain a
separate confirmed operation.

## Useful narrower extensions

### Build profiles

Compare build targets, scenes, scripting defines, player settings, and package
differences. A guarded operation could switch or apply a named profile.

### Input debugger

Show active devices, control schemes, action maps, bindings, and recent input
events during Play Mode. This is much easier to understand as a persistent UI
than as repeated tool output.

### Shader and rendering diagnostics

Summarize active render pipeline settings, shader variants, material keywords,
unsupported passes, and compilation failures for the selected assets.

### Navigation debugger

Inspect NavMesh surfaces, agents, paths, links, and unreachable targets. A scene
overlay or captured diagnostic artifact could complement the inspector panel.

### Save and dirty-state monitor

Show dirty scenes, unsaved assets, prefab stages, active imports, compilation,
and domain reload state. Guarded operations could save specific items rather
than issuing a broad save-all.

### Screenshot comparison

Capture a named Scene or Game view, compare it with a baseline, and show a
thumbnail, difference score, and artifact links. Baseline updates must be
explicit confirmed writes.

## Poor fits

- A thin button around an existing agent tool with no persistent state.
- Generic file editing, Git status, or transcript features that are not Unity
  package capabilities.
- Project-specific gameplay logic that belongs in the game's own assemblies.
- Unbounded log, profiler, hierarchy, or asset streaming.
- An extension that requires core to understand its payload fields.

The best next proof of the architecture is the Selection inspector. It is small
enough to implement cleanly, visibly useful, and different enough from Console
polling to expose whether the generic lifecycle and contribution APIs are truly
reusable.
