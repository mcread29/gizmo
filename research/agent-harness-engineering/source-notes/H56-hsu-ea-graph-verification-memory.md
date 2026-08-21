# [H56] EA-Graph: Artifact-Anchored Verification Memory for Coding Agents under Upstream Drift

- **Work ID / topic aliases:** W078 / H56
- **Authors:** Hwai-Jung Hsu, Cheng-Jan Chi, Hanna Everett
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2608.04278; exact version not independently verified
- **Canonical URL:** <https://arxiv.org/abs/2608.04278>
- **Version reviewed / version date:** not independently verified; submission date 2026-08-04 per abstract page
- **Published version / supersedes:** no archival publication verified
- **Correction or retraction status:** not verified
- **Accessed / last verified:** 2026-08-20
- **Acquisition:** abstract page scraped only; full text not reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2608.04278>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract only; no sections, tables, or figures reviewed
- **Discovery:** prospective search row H-20260820-005
- **Use status:** background
- **Reviewers:** single reviewer; second reviewer identity unknown/not retained

## Why it matters

Targets staleness-awareness of cross-session verification claims under upstream code drift, anchoring claims to specific repository/artifact states rather than prose notes. This is a distinct angle from the corpus's existing durable-memory coverage, which addresses what to store/retrieve but not whether a stored verification claim still holds after the underlying code changed.

## Methods and setting

Per the abstract: EA-Graph anchors verification claims to specific code artifacts at fine granularity, resolves aliases to source definitions, grounds each claim in the content used to establish it, and distinguishes evidence quality from currency; claims are marked unprovable rather than inferred when replacement content is unavailable. Evaluation used repositories with known ground truth, testing whether prior claims could be correctly classified as unaffected, affected, or unprovable after code drift, with the paper reporting an advantage over prose notes and no persistent memory for smaller language models, and non-significant results for larger models due to a performance ceiling. Exact repository set, sample sizes, and metrics were not retained beyond the abstract.

## Findings used in this library

- [HE060](../evidence/HE060.md), supporting [HC040](../claims/HC040.md): artifact-anchored verification memory is reported to outperform prose notes and no persistent memory at correctly classifying prior verification claims as unaffected/affected/unprovable after upstream code drift, for smaller language models; the paper reports the effect was not statistically significant for larger models, per the paper's own description.

## Limitations / validity threats

Abstract-only acquisition: no primary-text locator, table, or exact metric was reviewed. Preprint, small author team, no independent replication, and the authors' own reported non-significance for larger models limits generality. This record cannot support a quantitative or causal claim and is capped accordingly.

## Quotable passages

- "artifact-anchored memory outscored prose notes and no persistent memory" — abstract, restricted to smaller language models per the same abstract; exact page/section locator not retained.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 for full-text acquisition or a new version.

## Links to synthesis claims

- [HC040](../claims/HC040.md) via [HE060](../evidence/HE060.md).
