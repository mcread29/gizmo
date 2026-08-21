# [H06] AI Agents That Matter

- **Work ID / topic aliases:** W006 / H06, M25
- **Authors:** Sayash Kapoor, Benedikt Stroebl, Zachary S. Siegel, Nitya Nadgir, Arvind Narayanan
- **Year / venue:** 2025, Transactions on Machine Learning Research (TMLR)
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** OpenReview:Zy4uFzMviZ
- **Canonical URL:** <https://openreview.net/forum?id=Zy4uFzMviZ>
- **Version reviewed / version date:** arXiv:2407.01502v1 for extracted claims; TMLR publication metadata checked separately.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** publication metadata checked against OpenReview; the claims below were reviewed in the full arXiv v1 HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=Zy4uFzMviZ>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** publication metadata checked against OpenReview; the claims below were reviewed in the full arXiv v1 HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

- On HumanEval, simple retry/warming/escalation baselines formed a better accuracy–cost frontier than several then-SOTA reflection/tree-search/debugging agents. Similar accuracy differed by almost two orders of magnitude in cost; LATS was reported as more than 50× the warming baseline's cost (Sections 2.2–2.3; Table A1).
- Joint prompt/example optimization reduced variable cost by 53% for GPT-3.5 and 41% for Llama-3-70B at similar HotPotQA retrieval accuracy (Section 3.2).
- Seven of 17 surveyed agent benchmarks had no holdout and no stated plan for one; only five of ten existing holdouts matched the claimed level of generality (Section 5; Table A4).
- Reproduction uncovered inconsistent task subsets, evaluator bugs, and large reported/reproduced gaps (Section 6; Tables A6–A7).

## Limitations / validity threats

HumanEval is short-horizon and not representative of repository-scale work. API costs are time-sensitive. The HotPotQA study used 200 evaluation samples and the NovelQA cost comparison was run once. The paper criticizes evidence for complex control patterns; it does not prove they never help on harder tasks.

## Links to claims

- [HC006](../claims/HC006.md) via [HE009](../evidence/HE009.md).
- [HC007](../claims/HC007.md) via [HE010](../evidence/HE010.md).
- [HC009](../claims/HC009.md) via [HE012](../evidence/HE012.md).
- [HC014](../claims/HC014.md) via [HE018](../evidence/HE018.md).
