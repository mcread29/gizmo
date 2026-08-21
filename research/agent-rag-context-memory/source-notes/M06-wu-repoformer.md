# [M06] Repoformer: Selective Retrieval for Repository-Level Code Completion

- **Work ID / topic aliases:** W018 / H18, M06
- **Authors:** Di Wu, Wasi Uddin Ahmad, Dejiao Zhang, Murali Krishna Ramanathan, Xiaofei Ma
- **Year / venue:** 2024, ICML 2024, PMLR 235:53270–53290
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** PMLR `v235/wu24a`
- **Canonical URL:** <https://proceedings.mlr.press/v235/wu24a.html>
- **Version reviewed / version date:** ICML proceedings / arXiv v2 (2024-06-04)
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** official PMLR page and PDF tables inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://proceedings.mlr.press/v235/wu24a.html>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

One of the strongest direct demonstrations that retrieval is conditionally harmful and should be gated.

## Methods and setting

Same-model comparisons of no, always, and learned selective retrieval over repository completion. Training holds out 500 Stack repositories; CrossCodeLongEval repositories are later and checked for overlap. Models train two epochs on 8×A100-40GB. Greedy test decoding; no rerun CIs. [§§3–4]

## Findings used in this library

- On 455 RepoEval function cases, retrieval improved 25–53, harmed 16–23, and left 386–407 unchanged depending on model. [Figure 3; §5.1]
- At 1B, selective versus always retrieval: API ES 72.70 vs 69.17, line ES 76.00 vs 72.30, function pass 28.79 vs 25.71. [Table 2, p.7]
- Accuracy-preserving operating points gave roughly 27–33% speedup. [Table 3; Appendix E.3, Table 8]
- The main roughly 71% speedup point has a small quality loss; it is not accuracy preserving. [Appendix E.3, Table 8]

## Limitations / validity threats

Completion, not agent issue repair. “Up to 70% without harm” should be qualified because the principal ~70% point loses some quality. Function gate labels use edit similarity rather than execution. Serving speed depends on infrastructure.

## Exact claim/evidence links

- [MC008](../claims/MC008.md) ↔ [ME010](../evidence/ME010.md) — `synthesis.md §Strongest conclusions 3`
- [MC008](../claims/MC008.md) ↔ [ME011](../evidence/ME011.md) — `synthesis.md §Strongest conclusions 3`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
