# [H01] From Question Answering to Task Completion

- **Work ID / topic aliases:** W001 / H01
- **Authors:** Jianyuan Guo et al.
- **Year / venue:** 2026, arXiv
- **Document type:** survey
- **Publication status:** preprint
- **Stable IDs:** arXiv:2606.20683v1
- **Canonical URL:** <https://arxiv.org/abs/2606.20683>
- **Version reviewed / version date:** arXiv:2606.20683v1.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2606.20683v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

It explicitly separates foundation model from execution harness and synthesizes recent same-model/different-harness evidence.

## Methods and setting

Evolution-first survey spanning prompt, context/workflow, harness, and agent-native training. It proposes six runtime responsibilities: observation, context, control, action, state/artifacts, and verification/governance. Its empirical sections aggregate public SWE-bench Verified, Terminal-Bench 2.0, and WebArena results.

## Findings used in this library

- A useful implementation decomposition is model plus six coupled harness responsibilities (Sections 2.2–2.4; Figure 3).
- Public results show large within-model performance spreads across harnesses, but many comparisons remain observational because prompts, budgets, model snapshots, and proprietary scaffolds differ (Sections 7.3–7.5).
- Evaluation should include success, reliability, cost, latency, safety, and process quality rather than success alone (Sections 7.2 and 8.1).

## Limitations / validity threats

This is a June 2026 preprint, includes industry reports and leaderboard aggregates, and contains many very recent preprints. Its six-part taxonomy is useful synthesis, not a field-wide standard. Leaderboard comparisons do not establish that harness alone caused the observed spread.

## Links to claims

- [HC001](../claims/HC001.md) via [HE001](../evidence/HE001.md).
- [HC014](../claims/HC014.md) via [HE017](../evidence/HE017.md).
