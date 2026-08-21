# [M25] AI Agents That Matter

- **Work ID / topic aliases:** W006 / H06, M25
- **Authors:** Sayash Kapoor, Benedikt Stroebl, Zachary S. Siegel, Nitya Nadgir, Arvind Narayanan
- **Year / venue:** 2025, Transactions on Machine Learning Research (TMLR)
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed; extracted claims use the earlier arXiv version
- **Stable IDs:** OpenReview `Zy4uFzMviZ`; arXiv:2407.01502v1
- **Canonical URL:** <https://openreview.net/forum?id=Zy4uFzMviZ>
- **Version reviewed / version date:** arXiv v1
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=Zy4uFzMviZ>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Cost-aware benchmark/reproduction critique and simple-retry baselines for interpreting memory/reflection gains.

## Methods and setting

Reimplements/compares HumanEval agent methods with warming/retry/escalation; separately optimizes HotPotQA prompt/examples and audits benchmark holdouts/reproductions. API costs are dated; some studies have only one run. [§§2–6]

## Findings used in this library

- Simple warming/retry/escalation formed a better HumanEval accuracy–cost frontier than several reflection/tree-search/debugging agents; similar accuracy differed by nearly two orders of magnitude and LATS cost >50× warming. [Table A1; §§2.2–2.3]
- Joint prompt/example optimization reduced variable cost 53% for GPT-3.5 and 41% for Llama-3-70B at similar HotPotQA retrieval accuracy. [§3.2]
- Seven of 17 surveyed benchmarks had no holdout; only five of ten holdouts matched claimed generality. [Table A4; §5]
- Reproduction found subset/evaluator bugs and large gaps. [Tables A6–A7; §6]

## Limitations / validity threats

HumanEval is short; cost prices/snapshots age quickly. HotPotQA has 200 evaluation samples; one comparison ran once. Critiques do not prove complex methods never help.

## Exact claim/evidence links

- [MC023](../claims/MC023.md) ↔ [ME030](../evidence/ME030.md) — `synthesis.md §Strongest conclusions 6`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
