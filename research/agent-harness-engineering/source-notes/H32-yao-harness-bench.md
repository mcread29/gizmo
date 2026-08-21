# [H32] Harness-Bench: Measuring Harness Effects across Models in Realistic Agent Workflows

- **Work ID / topic aliases:** W032 / H32
- **Authors:** Yilun Yao, Xinyu Tan, Chao-Hsuan Liu, Yaoming Li, Zhengyang Wang, Wenhan Yu, Zhewen Tan, Yuxuan Tian, Guangxiang Zhao, Lin Sun, Xiangzheng Zhang, Tong Yang
- **Year / venue:** 2026, arXiv
- **Document type:** benchmark
- **Publication status:** preprint; not peer reviewed as of the cutoff
- **Stable IDs:** arXiv:2605.27922v1
- **Canonical URL:** <https://arxiv.org/abs/2605.27922>
- **Version reviewed / version date:** arXiv:2605.27922v1, submitted 2026-05-27.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2605.27922v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

Harness-Bench makes the model–harness pairing an explicit evaluation axis. It fixes external task conditions while running complete native harness configurations across a model matrix, and records artifacts, traces, usage, and validator outputs.

## Methods and setting

- 106 manually reviewed, sandboxed, offline workflow tasks in eight categories.
- Six configurable harnesses crossed with eight API model backends: 5,088 trajectories.
- Codex was separately evaluated in its model-bound default configuration on all tasks, yielding 5,194 trajectories total.
- Task prompt, initial sandbox, budget, timeout, and evaluator were fixed; each harness retained its native prompts, action format, tools, state policy, and recovery behavior.
- Completion used deterministic validators where possible and rubrics otherwise. Process dimensions were judged by a fixed Claude Sonnet 4.6 judge; explicit permission/security violations were a binary gate. [Sections 3.2–4.1]

## Findings used in this library

- Among configurable harnesses, aggregate score ranged from 52.4 for OpenClaw to 76.2 for NanoBot, a 23.8-point gap over the same task set and model-backend pool. [Table 2; Section 4.2]
- The paper identifies recurring failures at output contracts, tool recovery, evidence grounding, artifact commitment, and state continuation. Plausible reasoning often failed to become validator-readable workspace state. [Sections 5.1–5.2; Table 3]
- Cross-harness variance was larger for workflows involving structured data, tool sequencing, workspace mutation, and intermediate state than for language-centric office communication. [Appendix C]

## Limitations / validity threats

This is a v1 preprint. It compares whole native configurations, so the 23.8-point spread does not identify which prompt, context policy, tool interface, or recovery rule caused the difference. The benchmark is offline and sandboxed, has one trajectory per task–model–harness cell rather than repeated stochastic trials, and partly relies on an LLM process judge. The aggregate score is a benchmark diagnostic, not a deployment or security guarantee. Codex is not part of the configurable factorial comparison.

## Quotable passages

> “We use harness to denote the system layer that conditions model calls and turns model outputs into actions in an external workspace.” [Section 3, first paragraph after Figure 1]

> “The resulting measurements should therefore be interpreted as configuration-level diagnostics of model–harness pairings, not as causal decompositions of individual harness mechanisms.” [Section 3.1]

## Links to claims

- [HC001](../claims/HC001.md) via [HE003](../evidence/HE003.md).
- [HC019](../claims/HC019.md) via [HE023](../evidence/HE023.md).
- [HC020](../claims/HC020.md) via [HE024](../evidence/HE024.md).
