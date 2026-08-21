# [M05] RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation

- **Work ID / topic aliases:** W017 / H17, M05
- **Authors:** Fengji Zhang, Bei Chen, Yue Zhang, Jacky Keung, Jin Liu, Daoguang Zan, Yi Mao, Jian-Guang Lou, Weizhu Chen
- **Year / venue:** 2023, EMNLP 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2023.emnlp-main.151
- **Canonical URL:** <https://aclanthology.org/2023.emnlp-main.151/>
- **Version reviewed / version date:** EMNLP proceedings paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** ACL primary page and PDF tables inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2023.emnlp-main.151/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Controlled repository-level evidence for iterative retrieval, with an important boundary between completion and issue repair.

## Methods and setting

RepoEval contains 1,600 line, 1,600 API, and 373 function-body completions from post-2021 Python repositories. Same prompts/hyperparameters compare in-file, one-pass RAG, iterative, and oracle variants; Jaccard top-10 retrieval; one deterministic completion/item. [§§3–4]

## Findings used in this library

With GPT-3.5, two iterations versus in-file changed line EM 40.56→56.81, API EM 34.06→49.19, and function unit-test pass 23.32→42.63. One-pass RAG already reached 55.31/47.69/38.34. [Tables 2–3, PDF pp.6–7] Second-iteration API retrieval recall rose 86.04→90.34. [Table 4, p.7]

## Limitations / validity threats

Extra retrieval/generation is not call/token matched. Third/fourth iterations can regress; no stopping rule, latency, price, seeds, or CIs. Snapshot of GPT-3.5 is imprecise. Repository completion does not establish issue-resolution gains.

## Exact claim/evidence links

- [MC013](../claims/MC013.md) ↔ [ME018](../evidence/ME018.md) — `context-construction.md §Retrieval channels`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
