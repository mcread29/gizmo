# [M14] TapeAgents: A Holistic Framework for Agent Development and Optimization

- **Work ID / topic aliases:** W029 / H29, M14
- **Authors:** Dzmitry Bahdanau, Nicolas Gontier, Gabriel Huang, Ehsan Kamalloo, Rafael Pardinas, Alex Piché, Torsten Scholak, Oleh Shliazhko, Jordan Prince Tremblay, Karam Ghanem, Soham Parikh, Mitul Tiwari, Quaizar Vohra
- **Year / venue:** 2024, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** technical report / preprint
- **Stable IDs:** arXiv:2412.08445v1
- **Canonical URL:** <https://arxiv.org/abs/2412.08445>
- **Version reviewed / version date:** v1, 2024-12-11
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper and tables reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2412.08445v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Architecture evidence for append-only attributed records of observations and attempts, replay, resume, debugging, and training-data extraction. A tape is not ground truth merely because it records an event.

## Methods and setting

A tape appends granular observations, thoughts, actions, tool results, and metadata; tape views provide current context; a SQLite call database retains complete LLM calls. Quantitative studies primarily test distillation, not tape versus mutable state. [§2]

## Findings used in this library

- HotpotQA: 1,000 teacher tapes→3,000 examples; GPT-4 teacher 45% EM, finetuned Llama-3.1-8B 38%. [Table 3, PDF p.10]
- GREADTH: ~13,000 teacher turns; 1,524 partial dialogues from three held-out companies; GPT-4o teacher 75.8%, one-epoch LoRA 8B student 76.6%. [Tables 4–5, p.16]
- Reported serving economics approximately $85 versus $28,157 per million turns / ~300× cheaper; training eight H100s, inference one A100. [Figure 6; p.17]

## Limitations / validity threats

Headline economics bundle traces with supervised distillation and different models/hardware; zero-shot student was ~2.0%. One active controller/tape does not solve multi-writer consistency. Replay is deterministic only when recorded observations/LLM outputs are reused. Synthetic labels had a 10% manual audit.

## Exact claim/evidence links

- [MC033](../claims/MC033.md) ↔ [ME041](../evidence/ME041.md) — `structured-state-and-updates.md §Authoritative record of observations and attempts`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
