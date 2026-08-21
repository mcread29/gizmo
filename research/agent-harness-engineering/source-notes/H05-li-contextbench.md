# [H05] ContextBench

- **Work ID / topic aliases:** W005 / H05, M03
- **Authors:** Han Li et al.
- **Year / venue:** 2026, arXiv v3
- **Document type:** benchmark
- **Publication status:** preprint
- **Stable IDs:** arXiv:2602.05892v3
- **Canonical URL:** <https://arxiv.org/abs/2602.05892>
- **Version reviewed / version date:** arXiv:2602.05892v3.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2602.05892v3>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

1,136 issue-resolution tasks from 66 repositories and eight languages, annotated with compact human-verified “gold contexts”; a 500-task Lite split supports agent experiments. Agent trajectories are mapped through tree-sitter to file, definition-block, and line spans. The paper compares four models and five agents, with same-model agent comparisons using GPT-5.

## Findings used in this library

- More elaborate retrieval scaffolds did not consistently beat mini-SWE-agent: on the 500-task Lite set with GPT-5, Pass@1 ranged from 0.452 to 0.512 and no agent dominated retrieval metrics (Table 2; RQ1).
- Model behavior showed a recall/precision tradeoff; all block-level F1 scores were below 0.45 and line-level F1 below 0.35 (Table 3; RQ2).
- Retrieval strategy mattered operationally: average steps ranged from 5.87 to 22.16 and reported context-retrieval cost from $0.38 to $0.91 per instance (Table 4).
- Gold-relevant evidence was often observed and then dropped: usage-drop values ranged from 0.179 to 0.435 (Table 5; Appendix H).

## Limitations / validity threats

Gold context is compact and sufficient, not globally minimal (Appendix D). Its verification depends partly on GPT-5 producing at least one passing patch in five attempts, so the reference is model-mediated. Prompt instrumentation can itself alter behavior. The paper flags possible contamination/protocol mismatch for Devstral 2 (Appendix K). As a 2026 preprint, results need independent replication.

## Links to claims

- [HC002](../claims/HC002.md) via [HE005](../evidence/HE005.md).
- [HC003](../claims/HC003.md) via [HE006](../evidence/HE006.md).
- [HC004](../claims/HC004.md) via [HE007](../evidence/HE007.md).
