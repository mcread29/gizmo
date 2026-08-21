# [M34] Memory Injection Attacks on LLM Agents via Query-Only Interaction (MINJA)

- **Work ID / topic aliases:** W056 / M34
- **Authors:** Shen Dong, Shaochen Xu, Pengfei He, Yige Li, Jiliang Tang, Tianming Liu, Hui Liu, Zhen Xiang
- **Year / venue:** 2025, arXiv; revised 2026
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; no proceedings record verified
- **Stable IDs:** arXiv:2503.03704v5
- **Canonical URL:** <https://arxiv.org/abs/2503.03704>
- **Version reviewed / version date:** v5, 2026-02-12
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper evidence reviewed by security research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2503.03704v5>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Demonstrates delayed persistent poisoning where an ordinary user induces the agent itself to write malicious shared memory without backend access.

## Methods and setting

EHRAgent on MIMIC-III/eICU, RAP on 1.18M-product WebShop, and memory QA on MMLU. Nine victim-target pairs/configuration; 15 attack queries/pair (10 MMLU), mixed with 50 benign queries (30 MMLU); separate 30 victim queries/pair (10 MMLU). Requires memory shared across users. [threat model/experimental setup]

## Findings used in this library

- MIMIC GPT-4 ISR 95.6±7.0%, ASR 57.0±10.3%; eICU 98.5±2.8/90.0±3.5. [Table 1]
- WebShop GPT-4 96.3±4.6/77.4±14.5; GPT-4o 99.3±2.1/98.9±2.2. MMLU ISR 100%, ASR 68.9±19.1. [Table 1]
- Raising benign-memory density 25→100 reduced MIMIC ASR 68.9→31.1, but eICU only 95.6→88.9 and WebShop 98.9→97.8. [Table 4]
- Benign utility loss <2 points on EHR/WebShop but 10 on MMLU. [Table 1 discussion]

## Limitations / validity threats

Shared cross-user memory is an avoidable architecture choice; small number of victim pairs and high variance; no dollar cost; preprint. Attack/defense results are model/store specific.

## Exact claim/evidence links

- [MC038](../claims/MC038.md) ↔ [ME046](../evidence/ME046.md) — `security-privacy.md §Persistent memory poisoning`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
