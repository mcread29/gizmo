# [M30] RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval

- **Work ID / topic aliases:** W052 / M30
- **Authors:** Parth Sarthi, Salman Abdullah, Aditi Tuli, Shubh Khanna, Anna Goldie, Christopher D. Manning
- **Year / venue:** 2024, ICLR 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** OpenReview `GN921JHCRw`
- **Canonical URL:** <https://openreview.net/forum?id=GN921JHCRw>
- **Version reviewed / version date:** ICLR paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper/tables inspected by retrieval research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=GN921JHCRw>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Controlled evidence for hierarchical recursive summaries as an index, with observed summary hallucinations.

## Methods and setting

100-token leaves, SBERT, soft GMM clusters, GPT-3.5 recursive summaries, retrieval over leaves/summary levels. Same UnifiedQA-3B reader and 400-token budgets in controlled comparisons; GPT readers receive 2K. NarrativeQA, QASPER, QuALITY; no reruns/CIs. [§§3–4]

## Findings used in this library

SBERT→SBERT+tree changed QuALITY accuracy 54.9→56.6 and QASPER F1 36.23→36.70; DPR→DPR+tree 53.1→54.7 and 31.70→32.23. [Tables 1–2, PDF pp.7–8] About 4% of 150 randomly sampled summary nodes had minor hallucinations. [error analysis]

## Limitations / validity threats

Index construction needs repeated unpriced LLM calls and extra storage; OpenAI versions not pinned. Static document QA, not dynamic agent updates. Gains can be small and summary errors can propagate.

## Exact claim/evidence links

- [MC012](../claims/MC012.md) ↔ [ME017](../evidence/ME017.md) — `context-construction.md §Hierarchical and iterative retrieval`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
