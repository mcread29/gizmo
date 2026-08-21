# [H28] LongMemEval

- **Work ID / topic aliases:** W028 / H28, M01
- **Authors:** Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu
- **Year / venue:** ICLR 2025
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2410.10813
- **Canonical URL:** <https://openreview.net/forum?id=pZiyCaVuti>
- **Version reviewed / version date:** Exact arXiv/published artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the memory research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2410.10813>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the memory research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

The 500-question benchmark tests extraction, cross-session and temporal reasoning, updates, and abstention. At about 115K tokens, long-context models lost 30–66% versus oracle-evidence contexts. Multi-key indexing with original values plus extracted facts improved average recall 9.4% and downstream accuracy 5.4%; condensed keys alone generally underperformed original content. Reader capacity changed the useful retrieval budget. [Figure 3; Tables 3–4; §§4–5]

## Limitations / validity threats

Some product comparisons used a small 97-question pilot. The benchmark measures conversational memory, not all long-horizon agent state. Oracle context is an upper-reference condition.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
