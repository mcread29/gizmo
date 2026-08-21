# [H51] Cordon: Semantic Transactions for Tool-Using LLM Agents

- **Work ID / topic aliases:** W073 / H51
- **Authors:** Zheng Chen, Hanqing Liu, Duling Xu, Dong Dong, Jialin Li, Bangzheng Pu, Jidong Zhai
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2606.17573v1; DOI:10.48550/arXiv.2606.17573
- **Canonical URL:** <https://arxiv.org/abs/2606.17573v1>
- **Version reviewed / version date:** arXiv:2606.17573v1, 2026-06-16
- **Published version / supersedes:** no archival publication verified; future venue header is not treated as acceptance
- **Correction or retraction status:** arXiv history checked 2026-07-20; no withdrawal/correction identified
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full primary paper and arXiv metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/pdf/2606.17573v1>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; Sections 3–4 and 6, Tables 4–5, Figure 9
- **Discovery:** exact-version check H-20260720-025
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

Cordon directly tests a task-level containment boundary that stages effects and validates composed flows before commit.

## Methods and setting

The runtime uses shadow local state, an effect outbox, lineage/authority metadata, and validation over 45 constructed risk-bearing workflows, plus benign/overhead measurements.

## Findings used in this library

- [HE038](../evidence/HE038.md), supporting [HC027](../claims/HC027.md): Cordon provides ACID-like rollback only for mediated local/shadow state; released external effects require audit, idempotency, recovery, or compensation.
- [HE054](../evidence/HE054.md), supporting [HC034](../claims/HC034.md): in 45 constructed workflows Cordon blocked 45/45 before commit, while represented defense adapters blocked 14/45, missed 26, and detected five after commit; median rollback was 4.17 ms over 15 deterministic trials.

## Limitations / validity threats

Preprint; constructed workflows; one anonymized commercial agent; complete mediation and correct effect specifications are trusted. Opaque plugins and unobservable effects are outside containment. The result does not establish arbitrary cross-service atomicity.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 or on a new version/publication record.

## Links to synthesis claims

- [HC027](../claims/HC027.md) via [HE038](../evidence/HE038.md); [HC034](../claims/HC034.md) via [HE054](../evidence/HE054.md).
