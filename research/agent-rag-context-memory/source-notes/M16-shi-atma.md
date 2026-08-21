# [M16] A-TMA: Decoupling State-Aware Memory Failures in Long-Term Agent Memory

- **Work ID / topic aliases:** W043 / M16
- **Authors:** Zitong Shi, Yixuan Tang, Anthony Kum Hoe Tung
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.01935v2
- **Canonical URL:** <https://arxiv.org/abs/2607.01935>
- **Version reviewed / version date:** v2, 2026-07-08
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2607.01935v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Separates bank maintenance, state-aligned retrieval, and answer-time state resolution for old/current/transition conflicts.

## Methods and setting

LTP: 10 profiles, 400 mutable state units, 800 probes (400 historical, 400 current conflict). Full LoCoMo: 10 conversations/1,986 QA. Qwen2.5-3B answers, top-5 retrieval, Llama-3.3-70B judge. +A-TMA is an overlay on hosts. LTP judge human audit: 80% three-way agreement, κ=.699; binary 93%, κ=.847. [§5.1; Appendix A.1–A.6]

## Findings used in this library

- Graphiti/Zep LTP: QA .524→.635, conflict .480→.720, fact .568→.550. [Table 2]
- A-Mem: conflict .812→.860, fact .700→.698. [Table 2]
- InsideOut QA .117→.662, a large host-dependent gain. [Table 2]
- Full LoCoMo Graphiti temporal F1 .0295→.1705 and average F1 .0809→.1556, but several other cells/hosts are flat or negative. [Tables 3–4]

## Limitations / validity threats

Very recent preprint; constructed conflict benchmark anchored to LoCoMo. Overlay adds controllers/state metadata whose cost is not fully matched. Judge is model based. Main results support explicit state roles, not every A-TMA module or graphs universally.

## Exact claim/evidence links

- [MC028](../claims/MC028.md) ↔ [ME035](../evidence/ME035.md) — `synthesis.md §Strongest conclusions 7`
- [MC031](../claims/MC031.md) ↔ [ME038](../evidence/ME038.md) — `synthesis.md §Strongest conclusions 7`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
