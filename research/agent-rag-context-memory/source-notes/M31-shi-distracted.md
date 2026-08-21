# [M31] Large Language Models Can Be Easily Distracted by Irrelevant Context

- **Work ID / topic aliases:** W053 / M31
- **Authors:** Freda Shi, Xinyun Chen, Kanishka Misra, Nathan Scales, David Dohan, Ed H. Chi, Nathanael Schärli, Denny Zhou
- **Year / venue:** 2023, ICML 2023, PMLR 202:31210–31227
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** PMLR `v202/shi23a`
- **Canonical URL:** <https://proceedings.mlr.press/v202/shi23a.html>
- **Version reviewed / version date:** ICML proceedings paper
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** official PMLR/PDF evidence inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://proceedings.mlr.press/v202/shi23a.html>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Controlled demonstration that a single irrelevant sentence can reduce accuracy and consistency even on otherwise easy reasoning.

## Methods and setting

GSM-IC has 58,052 variants from 100 easy GSM8K problems with one verified-irrelevant sentence; main uniform sample 4,000. Greedy decoding except 20-sample self-consistency at temperature .7. [§§2–3]

## Findings used in this library

Code-davinci-002 one-shot CoT: 95% clean base accuracy, 72.4% micro on distracted variants, and 6% macro consistency. Least-to-most 77.5%/18%. Self-consistency recovered 93.4% micro but only 45% consistency. [Tables 2–3; PDF pp.3,6] “Ignore irrelevant information” helps but does not solve; four examples can improve clean accuracy while being less robust on >2-step distractors (69.4 vs 70.8, or 70.6 vs 76.0 with instruction). [Table 6, p.9]

## Limitations / validity threats

Easy training-set arithmetic deliberately selected; not an agent trajectory; old model and no costs. Macro consistency is stringent but captures brittleness.

## Exact claim/evidence links

- [MC003](../claims/MC003.md) ↔ [ME003](../evidence/ME003.md) — `working-context-and-compaction.md §Lost in the middle and distraction`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
