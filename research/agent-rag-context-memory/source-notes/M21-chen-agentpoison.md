# [M21] AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases

- **Work ID / topic aliases:** W047 / M21
- **Authors:** Zhaorun Chen, Zhen Xiang, Chaowei Xiao, Dawn Song, Bo Li
- **Year / venue:** 2024, NeurIPS 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.52202/079017-4136; arXiv:2407.12784v1
- **Canonical URL:** <https://doi.org/10.52202/079017-4136>
- **Version reviewed / version date:** NeurIPS / arXiv v1
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML and proceedings status inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://doi.org/10.52202/079017-4136>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Strong threat evidence that tiny poisoned fractions can persistently steer retrieval-based agent memory with little benign degradation.

## Methods and setting

Agent-Driver: 23K experiences, 20 poison, 250 held-out cases. StrategyQA ReAct: 10K passages, 4 poison, 229 test. EHRAgent: 700 experiences, 2 poison, 100 held-out. GPT-3.5/Llama-3 and end-to-end/contrastive retrievers; poisoned examples do not overlap test. Fewer than .1% database entries poisoned. [§4.1; Appendix A.1]

## Findings used in this library

- Aggregate across mixed memory/KB settings: retrieval ASR 81.2%, target action 59.4%, end-to-end 62.6%, average clean loss .74 points. [Table 1; §4.2]
- GPT-3.5 contrastive Agent-Driver: 80.0/68.5/56.8 retrieval/action/end-to-end, clean 91.1. EHR: 98.9/97.9/58.3, clean 72.9. [Tables 1–2]
- One poisoned instance still gave average 62.0% retrieval ASR; one trigger token 79.0%. [Figure 4]
- PPL/rephrasing defenses left AgentPoison end-to-end ASR 47.2–62.0 in tested cells. [Table 4]

## Limitations / validity threats

Aggregate mixes agent memory and RAG corpus. Optimized attack assumes white-box surrogate embedder, although transfer is tested. No dollar cost; threat-model and defense adaptation matter.

## Exact claim/evidence links

- [MC037](../claims/MC037.md) ↔ [ME045](../evidence/ME045.md) — `synthesis.md §Strongest conclusions 8`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
