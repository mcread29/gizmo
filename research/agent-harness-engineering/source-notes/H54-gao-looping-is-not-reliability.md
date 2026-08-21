# [H54] Looping Is Not Reliability: State-Bound Evidence and Typed Revision Contracts for Agentic Code Repair

- **Work ID / topic aliases:** W076 / H54
- **Authors:** Xueping Gao, Jianwei Yang, Qiang Yang
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.24604; exact version not independently verified
- **Canonical URL:** <https://arxiv.org/abs/2607.24604>
- **Version reviewed / version date:** not independently verified; submission date 2026-07-27 per abstract page
- **Published version / supersedes:** no archival publication verified
- **Correction or retraction status:** not verified
- **Accessed / last verified:** 2026-08-20
- **Acquisition:** abstract page scraped only; full text not reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2607.24604>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract only; no sections, tables, or figures reviewed
- **Discovery:** prospective search row H-20260820-003
- **Use status:** background
- **Reviewers:** single reviewer; second reviewer identity unknown/not retained

## Why it matters

Reports a negative/cautionary result about generate-test-revise loop reliability itself (as opposed to search/patch strategy, the focus of existing [H20]/[H21] coverage), and proposes binding verification evidence to specific code states.

## Methods and setting

Per the abstract: controlled experiments on 30 HumanEval repairs under forced-revision loops. The authors report correctness declined under forced revisions even as overall validity improved, and that using outdated (stale) verification traces produced a 22.2-point performance gap versus fresh traces. They propose an "evidence-bound typed loop contract" binding verification evidence to specific code states with auditable checkpoints, explicitly described by the authors as an executable specification rather than a proof of improved repair performance. Exact per-condition denominators, runs/seeds, and model/harness versions were not retained beyond the abstract.

## Findings used in this library

- [HE058](../evidence/HE058.md), supporting [HC038](../claims/HC038.md): in a 30-task HumanEval repair setting, forced-revision generate-test-revise loops did not monotonically improve correctness, and stale verification traces were associated with a reported 22.2-point performance gap versus fresh traces, per the paper's own description.

## Limitations / validity threats

Abstract-only acquisition: no primary-text locator, table, or exact metric was reviewed. Very small task set (30 HumanEval repairs), single benchmark, single-team authorship, no independent replication. The authors themselves caveat the proposed contract as a specification rather than a demonstrated reliability improvement. This record cannot support a quantitative or causal claim beyond the bounded observation and is capped accordingly.

## Quotable passages

None retained; abstract paraphrased only, no verbatim quotation acquired with a locator.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 for full-text acquisition or a new version.

## Links to synthesis claims

- [HC038](../claims/HC038.md) via [HE058](../evidence/HE058.md).
