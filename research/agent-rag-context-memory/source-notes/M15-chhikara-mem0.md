# [M15] Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory

- **Work ID / topic aliases:** W042 / M15
- **Authors:** Prateek Chhikara, Dev Khant, Saket Aryan, Taranjeet Singh, Deshraj Yadav
- **Year / venue:** 2025, arXiv
- **Document type:** system paper
- **Publication status:** preprint; vendor-authored
- **Stable IDs:** arXiv:2504.19413v1
- **Canonical URL:** <https://arxiv.org/abs/2504.19413>
- **Version reviewed / version date:** v1, 2025-04-28
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2504.19413v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Direct comparison of fact memory, graph augmentation, RAG chunking, and full context with quality/latency/token-footprint measurements.

## Methods and setting

LoCoMo's ten extended conversations (~26K tokens/~1,986 answerable questions in this protocol). GPT-4o-mini configured for several systems; RAG chunk 128–8192, k=1/2; LLM judge run ten times/method, temperature mostly 0. Adversarial category excluded because authors state ground truth unavailable. [§3]

## Findings used in this library

- Base Mem0 single-hop F1/judge 38.72/67.13; multi-hop 28.64/51.15. Graph did not improve these. [Table 1; §4.1]
- Temporal judge base/graph 55.51/58.13; graph temporal F1 51.55. [Table 1]
- Overall judge roughly Mem0 67%, graph 68.44%, best RAG ~61%, full context ~73%. [Table 2; §4.3]
- Full-context p95 ~17.117s; Mem0 1.440s; graph 2.590s. [Table 2; §§4.3–4.4]
- Store footprint ~7K memory tokens base, ~14K graph, ~26K raw conversation; one graph baseline >600K. [§4.5]

## Limitations / validity threats

Only ten conversations; LLM judge; vendor system and excluded adversarial questions. Full context is more accurate overall. Graph write/build calls and construction dollars are not compute matched; later retrieval timing in one baseline complicates freshness.

## Exact claim/evidence links

- [MC032](../claims/MC032.md) ↔ [ME039](../evidence/ME039.md) — `synthesis.md §Strongest conclusions 7`
- [MC032](../claims/MC032.md) ↔ [ME040](../evidence/ME040.md) — `synthesis.md §Strongest conclusions 7`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
