# [M24] Memory Poisoning Attack and Defense on Memory Based LLM-Agents

- **Work ID / topic aliases:** W048 / M24
- **Authors:** Balachandra Devarangadi Sunil, Isheeta Sinha, Piyush Maheshwari, Shantanu Todmal, Shreyan Mallik, Shuchi Mishra
- **Year / venue:** 2026, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2601.05504v2
- **Canonical URL:** <https://arxiv.org/abs/2601.05504>
- **Version reviewed / version date:** v2, 2026-01-12
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2601.05504v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Counterexample to idealized poisoning, plus unusually candid evidence that model-rated trust defenses can destroy utility or accept confident poison.

## Methods and setting

EHR agent/MIMIC-III; one victim-target pair; 50 generated indication prompts. Attack settings vary six initial clean memories, 2/4 indications, top-3/5/10 retrieval; GPT-4o-mini and Llama-3.1-8B. Defense attack set has 101 poison queries; separate GPT/Gemini runs. [§§5–8]

## Findings used in this library

- Empty-memory ASR/ISR GPT 62/100%, Llama 52.94/100%; relevant initial memory GPT 6.67/26.67%, Llama 0/99.95%. [Table 1]
- Top-3/5/10 ASR: GPT 6/20/38%; Llama 0/13.33/27.27%. [Table 2]
- GPT defense processed 23 candidates and rejected all; store stayed empty. [§8.1]
- Gemini accepted 82 at trust 1.0; 54 were malicious, and retrieval thresholding retained them. [§8.2]

## Limitations / validity threats

Small single-pair experiment, inconsistent narrative/metrics, no balanced benign utility, no independent replication, and model/guard configurations differ. Defense results are warning evidence, not a validated solution.

## Exact claim/evidence links

- [MC039](../claims/MC039.md) ↔ [ME047](../evidence/ME047.md) — `synthesis.md §Strongest conclusions 8`
- [MC040](../claims/MC040.md) ↔ [ME048](../evidence/ME048.md) — `synthesis.md §Strongest conclusions 8`
- [MC041](../claims/MC041.md) ↔ [ME049](../evidence/ME049.md) — `synthesis.md §Strongest conclusions 8`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
