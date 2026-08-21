# [H30] Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets

- **Work ID / topic aliases:** W030 / H30, M20
- **Authors:** Dat Tran, Douwe Kiela
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2604.02460
- **Canonical URL:** <https://arxiv.org/abs/2604.02460>
- **Version reviewed / version date:** Unverified; exact arXiv version reviewed was not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the memory/orchestration research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2604.02460>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the memory/orchestration research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

Across FRAMES and MuSiQue with Qwen3, DeepSeek-R1-Distill-70B, and Gemini 2.5, single-agent averages at 1K/2K/5K/10K reasoning-token caps were .418/.421/.427/.426. Sequential MAS scored .379/.389/.386/.387 and debate .388/.403/.420/.420. Under severe context masking/substitution, sequential MAS eventually overtook the single agent. [Table 1; §§5.1,5.3]

## Limitations / validity threats

Prompts/final answers were excluded and caps—not actual minimum total compute—were matched. Text-only multi-hop reasoning does not cover tool heterogeneity, parallelism, private information, or independent verification.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
