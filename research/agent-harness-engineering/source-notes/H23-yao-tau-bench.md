# [H23] τ-bench

- **Work ID / topic aliases:** W023 / H23, M26
- **Authors:** Shunyu Yao, Noah Shinn, Pedram Razavi, Karthik Narasimhan
- **Year / venue:** 2025, ICLR 2025
- **Document type:** benchmark
- **Publication status:** peer reviewed; experiments reviewed from the arXiv paper
- **Stable IDs:** arXiv:2406.12045
- **Canonical URL:** <https://openreview.net/forum?id=roNSXZpUDN>
- **Version reviewed / version date:** Exact arXiv paper artifact version not retained/unverified; ICLR 2025 status was checked separately.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety research thread; venue status cross-checked against the Princeton institutional record and author publication list
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2406.12045>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety research thread; venue status cross-checked against the Princeton institutional record and author publication list Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

Across 115 retail and 50 airline tasks with stateful APIs and a GPT-4 user simulator, GPT-4o function calling scored 61.2% retail and 35.2% airline. Retail `pass^8` fell below 25%, meaning fewer than one quarter of tasks succeeded in all eight equivalent reruns. [§§1,3; Table 2 and pass^k figure]

## Limitations / validity threats

Two synthetic domains and a model-based user simulator. `pass^k` reliability depends on the semantic-equivalence construction and simulator quality.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
