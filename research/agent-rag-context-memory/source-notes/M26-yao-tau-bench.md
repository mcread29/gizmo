# [M26] τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains

- **Work ID / topic aliases:** W023 / H23, M26
- **Authors:** Shunyu Yao, Noah Shinn, Pedram Razavi, Karthik Narasimhan
- **Year / venue:** 2025, ICLR 2025
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2406.12045; OpenReview `roNSXZpUDN`
- **Canonical URL:** <https://openreview.net/forum?id=roNSXZpUDN>
- **Version reviewed / version date:** ICLR 2025 published paper; exact arXiv version reviewed unknown/not retained
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper and venue status reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=roNSXZpUDN>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Stateful tool benchmark with deterministic database checks and repeated-run reliability (`pass^k`).

## Methods and setting

115 retail and 50 airline tasks, stateful APIs, benchmark policy documents, GPT-4 user simulator. Exact environment-state checks score task completion; repeated semantically equivalent runs estimate reliability. [§§2–3]

## Findings used in this library

GPT-4o function calling scored 61.2% retail and 35.2% airline. [Table 2] Retail `pass^8` fell below 25%, meaning fewer than one quarter of tasks succeeded in all eight runs. [`pass^k` figure]

## Limitations / validity threats

Two synthetic domains, model-based user simulator, and semantic-equivalence assumptions. This supports deterministic state/reliability evaluation; it is not a memory component ablation.

## Exact claim/evidence links

- [MC043](../claims/MC043.md) ↔ [ME053](../evidence/ME053.md) — `synthesis.md §Strongest conclusions 8`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
