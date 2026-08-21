# [M33] Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions (MemoryAgentBench)

- **Work ID / topic aliases:** W055 / M33
- **Authors:** Yuanzhe Hu, Yu Wang, Julian McAuley
- **Year / venue:** 2025, arXiv; revised 2026
- **Document type:** benchmark
- **Publication status:** preprint; no acceptance inferred from template
- **Stable IDs:** arXiv:2507.05257v4
- **Canonical URL:** <https://arxiv.org/abs/2507.05257>
- **Version reviewed / version date:** v4, 2026-06-28
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** arXiv metadata and primary paper tables reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2507.05257v4>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Broad benchmark of incremental retrieval, test-time learning, long-range understanding, and selective forgetting, with token-matched and construction-cost analyses.

## Methods and setting

Incremental contexts ~103K–1.44M tokens; 100–500 questions/task family; systems include long context, BM25, HippoRAG, MemGPT, Mem0, Zep, MIRIX and others. Some main comparisons use different chunk sizes/information access; strict GPT-4.1-mini token-matched table is more causal. No main seed averaging. [benchmark/method sections]

## Findings used in this library

- Common GPT-4o-mini reader: raw overall 42.3; BM25 41.5 overall but retrieval average 60.5 vs raw 49.2; MemGPT 28.3, Mem0 21.1, Zep 24.0. [main table]
- Strict token match: Banking77 ~4K full/BM25/MIRIX 74/83/52; ~40K 90/89/65; ~104K 93/88/67. Book summary ~4K 8.2/7.9/8.4; ~113K 39.7/38.0/38.8. Thus full context wins some larger-budget settings, while retrieval wins some smaller/focused settings. [token-matched table]
- Nearly all systems fail multi-hop selective forgetting. [main results]
- Construction time example MH-QA 512-token: Mem0 10,804s, Cognee 11,890s, MIRIX ~29,000s, BM25 .12s; indexing/embedding excluded from some query-cost estimates. [construction-cost appendix]

## Limitations / validity threats

Preprint; architecture/backbone/information differences in main rankings; no complete equal-index/storage/LLM-call comparison. Estimated costs omit index construction in some cells.

## Exact claim/evidence links

- [MC030](../claims/MC030.md) ↔ [ME037](../evidence/ME037.md) — `long-term-memory.md §Evidence gaps`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
