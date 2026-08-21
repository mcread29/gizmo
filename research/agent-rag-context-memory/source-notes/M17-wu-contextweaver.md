# [M17] ContextWeaver: Selective and Dependency-Structured Memory Construction for LLM Agents

- **Work ID / topic aliases:** W044 / M17
- **Authors:** Yating Wu, Yuhao Zhang, Sayan Ghosh, Sourya Basu, Anoop Deoras, Jun Huan, Gaurav Gupta
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2604.23069v1
- **Canonical URL:** <https://arxiv.org/abs/2604.23069>
- **Version reviewed / version date:** v1, 2026-04-24
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2604.23069v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Direct agent comparison of recency window, summaries, and dependency-structured raw-observation selection with execution-state labels.

## Methods and setting

SWE-agent on SWE-bench Verified/Lite; Claude-Sonnet-4, GPT-5, Gemini-3-Flash. Five-pair window and same masking format/context budget. A hybrid lets Claude build graph for GPT-5. Five runs on a random 100 Verified subset. [§4.1]

## Findings used in this library

- Claude unified Verified: dependency 66.0%, window 63.2%; Gemini dependency/window 58.4/60.4 on Verified but 47.0/46.0 on Lite. Summary hurt Gemini/GPT-5 relative to window. [Table 1; §4.2]
- Five-run subset: 68.0±1.55 versus 67.2±1.94 pass@1; pass@5 81 vs 78; mean steps 55.8 vs 59.2. [Table 2]
- Agent-side token savings 2.8% Verified/2.3% Lite; mean iterations -4.7%/-7.3%. [Figures 2–4]
- Paired cases: dependency 4/5 versus window 1/5 on cross-file Django; reverse on localized pytest. [§4.3; Appendix C]
- DAG 68.0±1.55 versus tree 67.0±2.92. [Table 3]

## Limitations / validity threats

Preprint; graph construction uses model calls and is only useful when builder quality is sufficient. Five-run subset is selected once; full benchmark appears single-run. Tool/test domain favors validation. No dollars/index build cost; localized tasks can be distracted.

## Exact claim/evidence links

- [MC019](../claims/MC019.md) ↔ [ME024](../evidence/ME024.md) — `synthesis.md §Strongest conclusions 4`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
