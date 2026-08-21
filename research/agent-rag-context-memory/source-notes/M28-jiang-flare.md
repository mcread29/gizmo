# [M28] Active Retrieval Augmented Generation (FLARE)

- **Work ID / topic aliases:** W050 / M28
- **Authors:** Zhengbao Jiang, Frank Xu, Luyu Gao, Zhiqing Sun, Qian Liu, Jane Dwivedi-Yu, Yiming Yang, Jamie Callan, Graham Neubig
- **Year / venue:** 2023, EMNLP 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2023.emnlp-main.495
- **Canonical URL:** <https://aclanthology.org/2023.emnlp-main.495/>
- **Version reviewed / version date:** EMNLP proceedings paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary PDF/tables inspected by retrieval research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2023.emnlp-main.495/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Active/forward-looking retrieval timing with positive, null, and harmful task cells.

## Methods and setting

`text-davinci-003`, at most 500 examples/task, BM25 Wikipedia or Bing. Same model/retriever for reimplemented baselines, but not exact reproductions. Hyperparameters selected on development sets; no CIs/reruns. [experimental section]

## Findings used in this library

- 2Wiki EM: no retrieval 28.2, single 39.4, question decomposition 47.8, FLARE 51.0. [Table 1, p.7975]
- Next-sentence query beat previous-sentence query, 48.8 vs 39.0 EM. [Table 3, p.7976]
- StrategyQA single retrieval 68.6 versus no retrieval 72.9; performance declined when retrieval frequency exceeded ~50%. [§6.2]
- No significant FLARE gain on Wizard of Wikipedia or ELI5. [§6.2/limitations]

## Limitations / validity threats

Repeated generation/retrieval adds uncached calls; cost unreported. Deprecated model and mutable Bing results. Baselines are reimplementations; static generation tasks.

## Exact claim/evidence links

- [MC010](../claims/MC010.md) ↔ [ME013](../evidence/ME013.md) — `context-construction.md §Reranking, deduplication, diversity, and gates`
- [MC010](../claims/MC010.md) ↔ [ME014](../evidence/ME014.md) — `context-construction.md §Reranking, deduplication, diversity, and gates`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
