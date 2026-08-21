# [H12] Why Do Multi-Agent LLM Systems Fail? (MAST)

- **Work ID / topic aliases:** W012 / H12
- **Authors:** Mert Cemri et al.
- **Year / venue:** NeurIPS 2025 Datasets and Benchmarks
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2503.13657
- **Canonical URL:** <https://arxiv.org/abs/2503.13657>
- **Version reviewed / version date:** Exact paper artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the memory/orchestration research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2503.13657>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the memory/orchestration research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

Analyzes 1,642 traces from seven multi-agent frameworks and derives 14 failure modes spanning system design, inter-agent alignment, and verification. Human annotation agreement reached κ=.88; a few-shot judge reached 94% accuracy and κ=.77. [Tables 1–2; Figure 2]

## Findings used in this library

Recurring failures include repeated steps, history loss, unknown or premature termination, information withholding/ignoring, and incomplete or incorrect verification. On ChatDev, prompt changes improved ProgramDev 25.0→34.4% and topology redesign to 40.6%; the topology did not significantly improve GPT-4 in another AG2 setting, showing model/task dependence. [Table 5]

## Limitations / validity threats

Trace taxonomies are diagnostic, not causal. Successful traces can contain latent verification defects. LLM-judge costs and errors remain relevant, and prompt/topology fixes did not transfer uniformly.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
