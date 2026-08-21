# [H18] Repoformer

- **Work ID / topic aliases:** W018 / H18, M06
- **Authors:** Di Wu, Wasi Uddin Ahmad, Dejiao Zhang, Murali Krishna Ramanathan, Xiaofei Ma
- **Year / venue:** ICML 2024, PMLR 235
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** PMLR 235:53270–53290; `wu24a`
- **Canonical URL:** <https://proceedings.mlr.press/v235/wu24a.html>
- **Version reviewed / version date:** Published ICML 2024/PMLR `wu24a`; exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** PMLR primary page scraped with Crawl4AI; PDF tables reviewed by the coding-context research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://proceedings.mlr.press/v235/wu24a.html>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** PMLR primary page scraped with Crawl4AI; PDF tables reviewed by the coding-context research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

A self-supervised gate predicts whether cross-file retrieval will improve repository-level code completion and suppresses retrieval otherwise.

## Findings used in this library

The paper's analysis found retrieval helpful on roughly 20% of RepoEval API-completion cases, neutral on over 60%, and harmful on roughly 20%. Accuracy-preserving selective-retrieval settings produced roughly 27–33% online-serving speedups. The approximately 70% speedup point incurred a small aggregate quality loss. [PDF pp. 5–7 and 20, Tables 2, 3, 8]

## Limitations / validity threats

These are completion tasks, not interactive issue repair. The speedups are condition-specific, and the highest reported point should not be described as quality-preserving.

## Links to claims

- [HC015](../claims/HC015.md) via [HE019](../evidence/HE019.md).
