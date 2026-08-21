# [M08] MemGPT: Towards LLMs as Operating Systems

- **Work ID / topic aliases:** W038 / M08
- **Authors:** Charles Packer, Sarah Wooders, Kevin Lin, Vivian Fang, Shishir G. Patil, Ion Stoica, Joseph E. Gonzalez
- **Year / venue:** 2023, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; no peer-reviewed venue verified
- **Stable IDs:** arXiv:2310.08560v2
- **Canonical URL:** <https://arxiv.org/abs/2310.08560>
- **Version reviewed / version date:** v2
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper/PDF evidence reviewed by memory research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2310.08560v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** background / qualifying evidence only
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Canonical model-managed context paging: the model uses function calls to search/edit external memory and move information into bounded context.

## Methods and setting

Deep Memory Retrieval uses 500 MSC conversations with five sessions; fixed-context baseline gets a lossy prior-session summary while MemGPT searches complete history. Document QA has 50 NaturalQuestions-Open questions. Nested-key task has 140 UUID pairs, 0–4 nesting, 30 orderings. [evaluation section/tables]

## Findings used in this library

DMR accuracy: GPT-3.5 fixed/MemGPT 38.7/66.9%; GPT-4 32.1/92.5%; GPT-4-Turbo 35.3/93.4%. [“Deep memory retrieval performance” table] MemGPT+GPT-4 remained robust on nested keys where direct GPT-4 variants reached zero by three levels. [nested-key figure]

## Limitations / validity threats

The baseline has less source information and fewer iterative calls, so comparisons are neither information nor compute matched. No repeats, CIs, cost, or full-context modern baseline. Function-calling reliability is a bottleneck. This supports paging over lossy summaries, not a universal model-managed-write default.

## Exact claim/evidence links

- [MC006](../claims/MC006.md) ↔ [ME008](../evidence/ME008.md) — `synthesis.md §Strongest conclusions 2`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
