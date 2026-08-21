# [M01] LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory

- **Work ID / topic aliases:** W028 / H28, M01
- **Authors:** Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu
- **Year / venue:** 2025, ICLR 2025
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2410.10813v2; OpenReview `pZiyCaVuti`
- **Canonical URL:** <https://openreview.net/forum?id=pZiyCaVuti>
- **Version reviewed / version date:** arXiv v2, 2025-03-04 / ICLR paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML and paper tables inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=pZiyCaVuti>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

The strongest unified ablation of memory value, indexing key, query reformulation, retrieval budget, and reader strategy reviewed here.

## Methods and setting

500 human-curated questions over extraction, multi-session/temporal reasoning, updates, and abstention. Standard histories are ~115K tokens; a larger setting reaches 500 sessions/~1.5M tokens. Main experiments use Stella-v5-1.5B retrieval, Llama-3.1-8B extraction, and GPT-4o/Llama-3.1-70B/8B readers. One generation/configuration; no CIs. GPT-4o judge agreement exceeded 97% overall. [§§3,5; Appendix A.4, Table 6]

## Findings used in this library

- At ~115K tokens, full reading lost 30.7%–66.3% relative to evidence-only oracle depending on model/CoN setting; e.g. GPT-4o .606 vs .870 and Llama-70B .334 vs .744 without CoN. [Figure 3b, PDF p.6]
- Round raw/fact/raw+fact Recall@5 was .582/.530/.644; GPT-4o top-5 QA .615/.588/.657. The paper reports average raw+fact gains of 9.4% recall and 5.4% QA. [Table 3, p.9; §5.3]
- Session summary-only GPT-4o top-10 QA was .252 versus .676 with original sessions. [Table 3]
- GPT-4o temporal expansion improved average recall 11.3% for rounds and 6.8% for sessions; weak Llama expansion sometimes regressed. [Table 4, p.10; §5.4]
- Reader budget differs: Llama-8B falls beyond ~3K retrieved tokens while GPT-4o can improve beyond 20K. [§5.2]
- Oracle reading still has up to a ten-point strategy gap; CoN+JSON is best. [Figure 6, p.10]

## Limitations / validity threats

No repeated-run uncertainty or end-to-end dollar/latency/storage cost. Histories mix synthetic and public chat data. Commercial-system pilot uses only 97 questions. Oracle evidence is an upper reference. Memory writes are not evaluated as live production updates.

## Exact claim/evidence links

- [MC001](../claims/MC001.md) ↔ [ME001](../evidence/ME001.md) — `synthesis.md §Strongest conclusions 1`
- [MC004](../claims/MC004.md) ↔ [ME004](../evidence/ME004.md) — `synthesis.md §Strongest conclusions 1`
- [MC005](../claims/MC005.md) ↔ [ME005](../evidence/ME005.md) — `synthesis.md §Strongest conclusions 2`
- [MC006](../claims/MC006.md) ↔ [ME006](../evidence/ME006.md) — `synthesis.md §Strongest conclusions 2`
- [MC007](../claims/MC007.md) ↔ [ME009](../evidence/ME009.md) — `context-construction.md §Query and task reformulation`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
