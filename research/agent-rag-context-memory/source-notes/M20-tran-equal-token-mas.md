# [M20] Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets

- **Work ID / topic aliases:** W030 / H30, M20
- **Authors:** Dat Tran, Douwe Kiela
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2604.02460v2
- **Canonical URL:** <https://arxiv.org/abs/2604.02460>
- **Version reviewed / version date:** v2
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by orchestration research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2604.02460v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Rare attempt to compare single and multi-agent systems under equal reasoning-token caps, with an information-masking boundary condition.

## Methods and setting

FRAMES and MuSiQue; Qwen3, DeepSeek-R1-Distill-70B, Gemini-2.5; single, sequential, and debate systems at 1K/2K/5K/10K thinking-token caps. Prompts/final answers excluded from cap; text QA only. [§§4–5]

## Findings used in this library

Single averages at 1K/2K/5K/10K: .418/.421/.427/.426. Sequential: .379/.389/.386/.387. Debate: .388/.403/.420/.420. [Table 1; §5.1] Sequential eventually overtook the single agent under severe context masking/substitution. [§5.3]

## Limitations / validity threats

Caps are not exact actual compute; coordination prompts/final outputs excluded. No tools, side effects, heterogeneous permissions, parallel latency, or independent verification. Preprint status.

## Exact claim/evidence links

- [MC035](../claims/MC035.md) ↔ [ME043](../evidence/ME043.md) — `synthesis.md §Multi-agent ownership / §What remains unproven`
- [MC036](../claims/MC036.md) ↔ [ME044](../evidence/ME044.md) — `synthesis.md §Multi-agent ownership / §What remains unproven`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
