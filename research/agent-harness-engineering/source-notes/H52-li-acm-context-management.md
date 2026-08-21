# [H52] ACM: Agentic Context Management for Long Horizon Tasks

- **Work ID / topic aliases:** W074 / H52
- **Authors:** Xiaochuan Li, Ryan Ming, Meng Chu, Shuai Shao, Rong Jin, Chenyan Xiong
- **Year / venue:** 2026, arXiv preprint
- **Document type:** system paper
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.23809; exact version not independently verified
- **Canonical URL:** <https://arxiv.org/abs/2607.23809>
- **Version reviewed / version date:** not independently verified; submission date 2026-07-26 per abstract page
- **Published version / supersedes:** no archival publication verified
- **Correction or retraction status:** not verified
- **Accessed / last verified:** 2026-08-20
- **Acquisition:** abstract page scraped only; full text not reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2607.23809>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract only; no sections, tables, or figures reviewed
- **Discovery:** prospective search row H-20260820-001
- **Use status:** background
- **Reviewers:** single reviewer; second reviewer identity unknown/not retained

## Why it matters

Proposes treating context compression/offload as an agent-invoked tool rather than a fixed heuristic policy, which is a distinct mechanism from prior harness context-management coverage (fixed pruning, retrieval-triggered compression).

## Methods and setting

Per the abstract: agents are given purpose-built context-editing tools (compress, offload to external storage, retrieve on demand) and trained with a post-training pipeline; reported evaluation domains are search and coding tasks. Exact task sets, model versions, baselines, and sample sizes were not retained beyond the abstract and are not extracted here.

## Findings used in this library

- [HE056](../evidence/HE056.md), supporting [HC036](../claims/HC036.md): agent-controlled context editing (compress/offload/retrieve) is reported to reduce computational overhead and improve solution consistency relative to fixed heuristic compression, per the paper's own description.

## Limitations / validity threats

Abstract-only acquisition: no primary-text locator, table, or exact metric was reviewed. Preprint, single-team authorship, no independent replication. This record cannot support a quantitative or causal claim and is capped accordingly.

## Quotable passages

None retained; abstract paraphrased only, no verbatim quotation acquired with a locator.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck by 2026-10-20 for full-text acquisition or a new version.

## Links to synthesis claims

- [HC036](../claims/HC036.md) via [HE056](../evidence/HE056.md).
