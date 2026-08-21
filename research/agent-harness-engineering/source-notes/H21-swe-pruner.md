# [H21] SWE-Pruner

- **Work ID / topic aliases:** W021 / H21
- **Authors:** Yuhang Wang, Yuling Shi, Mo Yang, Rongrui Zhang, Shilin He, Heng Lian, Yuting Chen, Siyu Ye, Kai Cai, Xiaodong Gu
- **Year / venue:** 2026, arXiv v4
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2601.16746v4
- **Canonical URL:** <https://arxiv.org/abs/2601.16746>
- **Version reviewed / version date:** arXiv:2601.16746v4.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper PDF reviewed by the coding-context research thread; arXiv v4 metadata/abstract page scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2601.16746v4>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper PDF reviewed by the coding-context research thread; arXiv v4 metadata/abstract page scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

A 0.6B line-skimmer prunes context for Mini SWE Agent and OpenHands with Claude Sonnet 4.5 and GLM-4.6. The arXiv v4 protocol allows a maximum of 250 interaction rounds.

## Findings used in this library

On SWE-bench Verified, the two configurations in Table 1 reduced tokens by 23.1% and 38.3% while increasing success by 1.4 and 1.2 percentage points, respectively. Table 2 reports the separate SWE-QA evaluation; its results are not combined with the SWE-bench Verified figures. [Tables 1–2]

## Limitations / validity threats

Preprint, principally Python, and small score differences need repeated-run uncertainty. The result supports task-aware pruning, not indiscriminate deletion.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
