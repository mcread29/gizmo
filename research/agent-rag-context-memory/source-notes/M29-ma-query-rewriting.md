# [M29] Query Rewriting in Retrieval-Augmented Large Language Models

- **Work ID / topic aliases:** W051 / M29
- **Authors:** Xinbei Ma, Yeyun Gong, Pengcheng He, Hai Zhao, Nan Duan
- **Year / venue:** 2023, EMNLP 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2023.emnlp-main.322
- **Canonical URL:** <https://aclanthology.org/2023.emnlp-main.322/>
- **Version reviewed / version date:** EMNLP proceedings paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary PDF/tables inspected by retrieval research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2023.emnlp-main.322/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Controlled same-reader evidence that rewriting can repair weak queries while sometimes underperforming naive retrieval.

## Methods and setting

Bing retrieval, fixed ChatGPT reader, either frozen ChatGPT few-shot rewriter or PPO-trained T5. HotpotQA full eval, first 1,000 AmbigNQ, PopQA train/test, custom 80/20 MMLU. Demonstrations are 1–3 fixed random examples; no reruns/CIs. [§§3–4]

## Findings used in this library

HotpotQA EM: no retrieval 32.36, retrieve-read 30.47, frozen rewrite 32.80, trainable rewrite 34.38. AmbigNQ retrieve-read 45.80/58.50 EM/F1 versus trained rewrite 47.80/60.71; answer hit 76.4→82.2%. [Tables 2,4; pp.5309–5310] MMLU Social Science rewrite 76.4 versus retrieve-read 78.2. [Table 4]

## Limitations / validity threats

Bing index/date not pinned; training and extra query-generation cost unreported; static QA and no uncertainty. One-turn rewriting does not establish iterative agent reformulation.

## Exact claim/evidence links

- [MC011](../claims/MC011.md) ↔ [ME015](../evidence/ME015.md) — `context-construction.md §Query rewriting`
- [MC011](../claims/MC011.md) ↔ [ME016](../evidence/ME016.md) — `context-construction.md §Query rewriting`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
