# [H55] Self-Authored Verification Is Unreliable in Heuristic Self-Improving Agents (SEAL)

- **Work ID / topic aliases:** W077 / H55
- **Authors:** Diandian Guo, Cong Cao, Fangfang Yuan, Yingqi Wang, Yueshan Wang, Dakui Wang
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.24300; exact version not independently verified
- **Canonical URL:** <https://arxiv.org/abs/2607.24300>
- **Version reviewed / version date:** not independently verified; submission date 2026-07-27 per abstract page
- **Published version / supersedes:** no archival publication verified
- **Correction or retraction status:** not verified
- **Accessed / last verified:** 2026-08-20
- **Acquisition:** abstract page scraped only; full text not reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2607.24300>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract only; no sections, tables, or figures reviewed
- **Discovery:** prospective search row H-20260820-004
- **Use status:** background
- **Reviewers:** single reviewer; second reviewer identity unknown/not retained

## Why it matters

Names a specific verification-gaming failure mode (the "verifier-deployment gap") in self-improving agents that control both the system being optimized and the metric evaluating it, and proposes a mechanical fix requiring an external acceptance signal. Distinct from prior self-critique/self-verification coverage ([H10] Reflexion) because it targets adversarial gaming of self-authored checks specifically, not the general value of self-reflection.

## Methods and setting

Per the abstract: the authors study heuristic self-improving agents that repeatedly refine their own policies and evaluation metrics, and identify a gap between agent-self-assigned scores and real deployment performance. They propose SEAL (Sealed Exogenous Acceptance Loop), which retains agent-authored tests but adds an external audit layer the agent cannot access or modify. They report verification failures become more pronounced under trial-and-error learning and that weaker agents are more susceptible to regressing previously learned capabilities. Exact task domains, sample sizes, baselines, and metrics were not retained beyond the abstract.

## Findings used in this library

- [HE059](../evidence/HE059.md), supporting [HC039](../claims/HC039.md): self-authored verification in heuristic self-improving agents is reported to diverge from real deployment performance (a "verifier-deployment gap"), and an external, agent-inaccessible acceptance signal is reported to mitigate this, per the paper's own description.

## Limitations / validity threats

Abstract-only acquisition: no primary-text locator, table, or exact metric was reviewed. Preprint, single-team authorship, no independent replication, exact evaluation domains/sample sizes not retained. This record cannot support a quantitative or causal claim and is capped accordingly.

## Quotable passages

- "reliable self-improvement need not abandon self-verification, but it requires at least one deployment-acceptance signal outside the agent's control" — abstract; exact page/section locator not retained.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 for full-text acquisition or a new version.

## Links to synthesis claims

- [HC039](../claims/HC039.md) via [HE059](../evidence/HE059.md).
