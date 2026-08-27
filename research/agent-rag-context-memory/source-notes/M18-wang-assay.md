# [M18] Not All Skills Help: Measuring and Repairing Agent Knowledge

- **Work ID / topic aliases:** W045 / M18
- **Authors:** Yixuan Wang, Yiyang Zhou, Yiming Liang, Congyu Zhang, Fuxiao Liu, Jiawei Zhou, Huaxiu Yao
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2606.15390v1
- **Canonical URL:** <https://arxiv.org/abs/2606.15390>
- **Version reviewed / version date:** v1, 2026-06-13
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2606.15390v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Rare causal skill-library study using randomized masking and disjoint train/development/test data; retains null and harmful results.

## Methods and setting

AppWorld 90 train, 15 dev, 168 normal + 417 challenge test; τ-bench 500 train, 15 dev, 115 test. Seven models/four providers. Per model: 12 random masks × 15 dev tasks = 180 agent rollouts; causal scores drive split/retire/merge and per-task masking. Temperature 0; AppWorld 40-step and τ-bench 30-turn budgets. [§§2–3.1]

## Findings used in this library

- GPT-5.1 AppWorld challenge: bare ReAct 52.5%, upstream uncurated library 49.9%, Assay 66.4%; level-3 uncurated→Assay 43.1→71.3. [Table 1; Figure 3]
- DeepSeek-V3 challenge 47.0 bare, 63.1 upstream, 69.3 Assay. [Table 1]
- GPT-4.1 τ-bench 68.0→73.9; GPT-5.1 62.6→62.6 and Sonnet-4.5 73.0→73.0. [Table 2; §3.2]
- Per-task masking is largest ablation increment (~10.7% relative); reverse masking -4.7 points. [§3.3; Appendix A.1]
- > 90% of 103 GPT-5.1 skills had per-task causal range >.40; 97.2% masking decisions directionally stable under resampling. [Appendix A.1; §3.1]

## Limitations / validity threats

Very recent preprint; only 15 development tasks/model and nearest-neighbor transfer; high offline optimization cost; one test execution/task at temperature 0. Re-attribution is model specific and online-growing libraries remain untested.

## Exact claim/evidence links

- [MC026](../claims/MC026.md) ↔ [ME033](../evidence/ME033.md) — `synthesis.md §Strongest conclusions 5`
- [MC027](../claims/MC027.md) ↔ [ME034](../evidence/ME034.md) — `workflows-and-skills.md §Flat libraries and routing`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
