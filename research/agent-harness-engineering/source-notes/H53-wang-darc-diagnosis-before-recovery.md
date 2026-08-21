# [H53] Diagnosis Before Recovery: Turning Agent Failures into Selective Self-Correction (DARC)

- **Work ID / topic aliases:** W075 / H53
- **Authors:** Pan Wang, Yihao Hu, Hang Wang, Zirui Lv, Xin Zhang, Jianshe Li, Jiang-Ming Yang, Wei Wu, Yongqi Tong
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2608.11772; exact version not independently verified
- **Canonical URL:** <https://arxiv.org/abs/2608.11772>
- **Version reviewed / version date:** not independently verified; submission date 2026-08-12 per abstract page
- **Published version / supersedes:** no archival publication verified
- **Correction or retraction status:** not verified
- **Accessed / last verified:** 2026-08-20
- **Acquisition:** abstract page scraped only; full text not reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2608.11772>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract only; no sections, tables, or figures reviewed
- **Discovery:** prospective search row H-20260820-002
- **Use status:** background
- **Reviewers:** single reviewer; second reviewer identity unknown/not retained

## Why it matters

Proposes a control-loop-level recovery mechanism keyed to diagnosed failure type, which is a mechanism the corpus's existing failure-taxonomy coverage (MAST, [H12]) does not itself supply.

## Methods and setting

Per the abstract: DARC profiles development-set errors to identify which recovery interventions suit which failure modes, then deploys a verifier-selected policy determining both what is repaired and how much corrective evidence/budget to use. Reported evaluation environments are ALFWorld, AppWorld, and XBRL Finance. Exact metrics, sample sizes, baselines, and ablations were not retained beyond the abstract and are not extracted here.

## Findings used in this library

- [HE057](../evidence/HE057.md), supporting [HC037](../claims/HC037.md): a failure-type-conditioned, verifier-selected recovery policy is reported to improve average task performance over base agents and over broad/unconditional recovery playbooks, while using fewer environment steps or less retrieval budget, across ALFWorld, AppWorld, and XBRL Finance, per the paper's own description.

## Limitations / validity threats

Abstract-only acquisition: no primary-text locator, table, or exact metric was reviewed. Preprint, single-team authorship, no independent replication. This record cannot support a quantitative or causal claim and is capped accordingly.

## Quotable passages

None retained; abstract paraphrased only, no verbatim quotation acquired with a locator.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 for full-text acquisition or a new version.

## Links to synthesis claims

- [HC037](../claims/HC037.md) via [HE057](../evidence/HE057.md).
