# [M27] Interleaving Retrieval with Chain-of-Thought Reasoning for Knowledge-Intensive Multi-Step Questions

- **Work ID / topic aliases:** W049 / M27
- **Authors:** Harsh Trivedi, Niranjan Balasubramanian, Tushar Khot, Ashish Sabharwal
- **Year / venue:** 2023, ACL 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2023.acl-long.557
- **Canonical URL:** <https://aclanthology.org/2023.acl-long.557/>
- **Version reviewed / version date:** ACL proceedings paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary PDF/tables inspected by retrieval research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2023.acl-long.557/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Direct repeated-prompt evidence for retrieval interleaved with generated reasoning rather than retrieve-once.

## Methods and setting

HotpotQA, 2Wiki, MuSiQue, IIRC; 100 tuning and 500 test items/dataset. BM25 retrieval follows each reasoning sentence, maximum eight reasoning steps and 15 accumulated passages. Three independently sampled 15-example demonstration sets; mean±SD over three prompt runs. [§§3–4]

## Findings used in this library

Against one-step retrieval, Flan-T5-XXL IRCoT increased retrieval recall by 7.9/14.3/3.5/10.2 points and QA F1 by 9.4/15.3/5.0/2.5 on the four datasets. GPT-3 recall gains were 11.3/22.6/12.5/21.2, but QA gains 7.1/13.2/7.1 and no IIRC improvement. [Figures 3–4; §§5; pp.10019–10020]

## Limitations / validity threats

Up to one LLM/retrieval call per reasoning sentence; no dollar/latency report; `code-davinci-002` is deprecated. Static QA, not tool agents. Better recall did not always improve answers.

## Exact claim/evidence links

- [MC009](../claims/MC009.md) ↔ [ME012](../evidence/ME012.md) — `context-construction.md §Hierarchical and iterative retrieval`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
