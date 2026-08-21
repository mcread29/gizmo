# [M32] Evaluating Memory Structure in LLM Agents (StructMemEval)

- **Work ID / topic aliases:** W054 / M32
- **Authors:** Alina Shutova, Alexandra Olenina, Ivan Vinogradov, Anton Sinitsin
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint / work in progress
- **Stable IDs:** arXiv:2602.11243v2
- **Canonical URL:** <https://arxiv.org/abs/2602.11243>
- **Version reviewed / version date:** v2, 2026-05-22
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** arXiv metadata and primary PDF evidence reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2602.11243v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Tests incremental organization/writes into ledgers, trees, state transitions, and indexes rather than only factual passage retrieval.

## Methods and setting

207 generated scenarios; main test 51. Frameworks include retrieval, EMem/EMem-G, Mem0, and Mem-agent across several frontier backbones. Tasks include count-based ledgers, trees, state transitions, and recommendation structures. [PDF p.4]

## Findings used in this library

With Gemini-3.1-Pro, cross-framework total accuracy: retrieval .060, EMem .175, EMem-G .190, Mem0 .390, Mem-agent .660. [Table 1, PDF p.6] Count tasks remain especially weak; several cells are zero. On 42 state-tracking cases, explicit structure hints changed Gemini Mem-agent 64→79% and Mem0 62→81%. [state-hint table, PDF p.33]

## Limitations / validity threats

Generated small main test, preprint/work in progress, model/framework costs and information access not equal, and no repeated-run uncertainty. Structural validity does not guarantee source truth or safe concurrent updates.

## Exact claim/evidence links

- [MC029](../claims/MC029.md) ↔ [ME036](../evidence/ME036.md) — `structured-state-and-updates.md §Structured-memory benchmark evidence`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
