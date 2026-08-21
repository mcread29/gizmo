# [M19] Memory as a Controlled Process: Learned Adaptive Memory Management for LLM Agents

- **Work ID / topic aliases:** W046 / M19
- **Authors:** Eric Hanchen Jiang, Zhi Zhang, Yuchen Wu, Levina Li, Dong Liu, Xiao Liang, Rui Sun, Yubei Li, Edward Sun, Haozheng Luo, Zhaolu Kang, Aylin Caliskan, Kai-Wei Chang, Ying Nian Wu
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.13591v1
- **Canonical URL:** <https://arxiv.org/abs/2607.13591>
- **Version reviewed / version date:** v1, 2026-07-15
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2607.13591v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Learned but lightweight decision policy for retrieve/plan/re-retrieve/consolidate/forget/no-op, with a direct controller ablation.

## Methods and setting

Six benchmarks: ALFWorld 134, PDDL 100, ScienceWorld 100, TriviaQA 200, WebWalkerQA 200, GAIA 165; three frameworks/backbones. MemCon adds a tabular UCB controller to a fixed memory backend; no extra LLM call is used for policy lookup. Hyperparameters use a held-out 30-task ALFWorld subset; each configuration is one online deployment run, no seed averaging. [§4.1; Appendix A]

## Findings used in this library

- GPT-4.1-mini Lobster ALFWorld isolated learned-controller comparison is 59.7%→64.9% (+5.2 points). The full bundled MemCon system reaches 67.9%; the remaining gain comes from other components. [Table 2; §4.3]
- Full MemCon uses 39K input tokens at 67.9% versus the 59.7% fixed-pipeline baseline at 45K; other full-system cells show ~5–20% savings. Token savings are not isolated controller effects. [§4.2; token Table 5]
- MemCon top/near-top in many of 54 cells, but baseline ordering is inconsistent. [Tables 1,3,4]

## Limitations / validity threats

July 2026 preprint; single sequential run and learning on evaluation stream; potential nonstationarity/order effects; reimplemented baselines; maintenance actions can no-op; no dollars/latency beyond policy claim. Claims of universal backend transfer are not fully ablated.

## Exact claim/evidence links

- [MC034](../claims/MC034.md) ↔ [ME042](../evidence/ME042.md) — `long-term-memory.md §Learned managers and automatic policies`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
