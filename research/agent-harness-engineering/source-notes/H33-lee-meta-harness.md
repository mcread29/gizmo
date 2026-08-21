# [H33] Meta-Harness: End-to-End Optimization of Model Harnesses

- **Work ID / topic aliases:** W033 / H33
- **Authors:** Yoonho Lee, Roshen Nair, Qizheng Zhang, Kangwook Lee, Omar Khattab, Chelsea Finn
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2603.28052v1
- **Canonical URL:** <https://arxiv.org/abs/2603.28052>
- **Version reviewed / version date:** arXiv:2603.28052v1, submitted 2026-03-30.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2603.28052v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

Meta-Harness treats executable harness code as an optimization target. A coding-agent proposer selectively inspects prior candidate source, scores, and raw traces through a filesystem, proposes new harnesses, and leaves evaluation to an external loop.

## Methods and setting

The frozen base model is wrapped by a stateful task-specific program controlling context, retrieval, memory, and orchestration. Candidate code, scores, and traces are retained in a queryable filesystem. Experiments cover online classification, retrieval-augmented olympiad math, and TerminalBench-2. Candidate promotion uses search-set performance and a Pareto frontier; proposed code must first pass lightweight interface validation. [Section 3; Algorithm 1]

## Findings used in this library

- Online classification test accuracy was 48.6%, versus 40.9% for ACE, while additional context was 11.4K versus 50.8K tokens. [Table 2]
- In the proposer-interface ablation, raw-trace access reached 50.0 median and 56.7 best search accuracy; scores-only reached 34.6/41.3, and scores plus generated summaries reached 34.9/38.7. [Table 3]
- One discovered retrieval harness improved average accuracy from 34.1 to 38.8 over no retrieval across five evaluated models on 200 unseen IMO-level problems. [Section 4.2; Table 6]
- On TerminalBench-2, the discovered harness scored 76.4% with Opus 4.6 versus 74.7% for Terminus-KIRA, and 37.6% with Haiku 4.5 versus 35.5% for Goose. [Table 7]
- In the TerminalBench search, the proposer read a median 82 files per iteration, split mainly between prior source and execution traces. [Appendix A.1; Table 8]

## Limitations / validity threats

This is a v1 preprint using one strong proprietary proposer, Claude Code with Opus 4.6. Search is expensive and evaluation-domain specific. Most importantly, TerminalBench-2 search and final scoring use the same 89 public tasks; audits found no explicit task-string leakage, but benchmark specialization remains and the reported pass rates are not an untouched-test estimate. The classification and math studies provide better held-out evidence, but across different task forms. Automated gains do not establish that unrestricted self-modification is safe.

## Quotable passages

> “A harness is a stateful program that wraps a language model and determines what context the model sees at each step.” [Section 3, “Objective”]

> “The proposer never sees test-set results; its only feedback comes from the search set.” [Section 3, “Meta-Harness search loop”]

## Links to claims

- [HC021](../claims/HC021.md) via [HE025](../evidence/HE025.md).
- [HC022](../claims/HC022.md) via [HE026](../evidence/HE026.md).
- [HC022](../claims/HC022.md) via [HE027](../evidence/HE027.md).
