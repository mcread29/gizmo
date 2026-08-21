# [M07] The Complexity Trap: Simple Observation Masking Is as Efficient as LLM Summarization for Agent Context Management

- **Work ID / topic aliases:** W037 / M07
- **Authors:** Tobias Lindenbauer, Igor Slinko, Ludwig Felder, Egor Bogomolov, Yaroslav Zharov
- **Year / venue:** 2025, arXiv / workshop manuscript
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; workshop title appears in reviewed v3, no archival peer review verified
- **Stable IDs:** arXiv:2508.21433v3
- **Canonical URL:** <https://arxiv.org/abs/2508.21433>
- **Version reviewed / version date:** v3, 2025-10-27
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2508.21433v3>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

The best direct, cost-aware comparison of raw agent history, old-observation masking, and LLM summary in a long tool-agent setting.

## Methods and setting

SWE-agent on all 500 SWE-bench Verified tasks; 250-turn limit; Qwen3-32B thinking/non-thinking, Qwen3-Coder-480B, Gemini-2.5-Flash thinking/non-thinking. Masking window 10; summary 21 older + 10-tail. Same tasks/scaffold, but token/call totals differ by strategy. Paired 10,000-bootstrap inference over tasks; not repeated agent seeds. [§§3–4; Tables 1,4]

## Findings used in this library

- Qwen3-Coder: raw 53.4%/$1.29, mask 54.8%/$0.61, summary 53.8%/$0.64 per instance. [Table 1]
- Gemini Flash: 32.8/$0.41, 35.6/$0.18, 36.0/$0.24. [Table 1]
- Gemini Flash thinking: raw 40.4%, mask 36.4%, summary 31.4%; both regressions significant. [Tables 3–4]
- Summary never consistently/significantly beat masking, cost up to 7.2% directly, and elongated two model trajectories by ~15%. [Figure 4; Table 2; §§4.4,5.2]
- OpenHands required scaffold-specific window retuning; hybrid result used only 50 tasks. [§§5.1,5.3]

## Limitations / validity threats

One domain with verbose tool output; heuristic schedules; model price conversion is dated; hyperparameter tuning/test separation is imperfect. Summary designs could improve. Main uncertainty is over task sampling, not model stochasticity.

## Exact claim/evidence links

- [MC016](../claims/MC016.md) ↔ [ME021](../evidence/ME021.md) — `synthesis.md §Strongest conclusions 4`
- [MC017](../claims/MC017.md) ↔ [ME022](../evidence/ME022.md) — `synthesis.md §Strongest conclusions 4`
- [MC018](../claims/MC018.md) ↔ [ME023](../evidence/ME023.md) — `synthesis.md §Strongest conclusions 4`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
