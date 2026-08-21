# [M03] ContextBench: A Benchmark for Context Retrieval in Coding Agents

- **Work ID / topic aliases:** W005 / H05, M03
- **Authors:** Han Li, Letian Zhu, Bohan Zhang, Rili Feng, Jiaming Wang, Yue Pan, Earl T. Barr, Federica Sarro, Zhaoyang Chu, He Ye
- **Year / venue:** 2026, arXiv
- **Document type:** benchmark
- **Publication status:** preprint; no peer-reviewed venue verified
- **Stable IDs:** arXiv:2602.05892v3
- **Canonical URL:** <https://arxiv.org/abs/2602.05892>
- **Version reviewed / version date:** v3, 2026-02-11
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2602.05892v3>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Directly measures what coding agents explore and later use, not only whether the final patch passes.

## Methods and setting

1,136 issue-resolution tasks from 66 repositories/eight languages with human-annotated compact sufficient contexts; 500-task Lite agent split. Tree-sitter maps trajectories to files, definition blocks, and lines. Model comparisons hold mini-SWE-agent fixed; agent comparisons hold GPT-5 fixed. One trajectory/task; repeats/CIs absent. [§§2–3]

## Findings used in this library

- With GPT-5, agent Pass@1 ranged .452–.512; no scaffold dominated retrieval. mini-SWE line recall/precision/F1 .606/.301/.312 versus Prometheus .584/.195/.231. [Table 2, PDF p.7]
- With mini-SWE fixed, all block F1 values were below .45 and line F1 below .35. [Table 3, p.8]
- Relevant evidence was observed and then dropped: usage-drop .179 GPT-5, .196 Claude, .431 Gemini, .435 Devstral. [Table 5, p.10]
- Average retrieval cost/instance $0.38–$0.91; retrieval steps 5.87–22.16. [Table 4, p.9]

## Limitations / validity threats

Gold context is patch-conditioned and sufficient, not globally minimal. Verification partly depends on GPT-5 pass@5. Public SWE-bench-derived data has contamination risk; Appendix K flags possible Devstral contamination/protocol mismatch. Prompt/tool differences weaken cross-agent causality.

## Exact claim/evidence links

- [MC014](../claims/MC014.md) ↔ [ME019](../evidence/ME019.md) — `synthesis.md §Strongest conclusions 3`
- [MC015](../claims/MC015.md) ↔ [ME020](../evidence/ME020.md) — `synthesis.md §Strongest conclusions 3`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
