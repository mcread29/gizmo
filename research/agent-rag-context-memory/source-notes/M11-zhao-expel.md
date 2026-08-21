# [M11] ExpeL: LLM Agents Are Experiential Learners

- **Work ID / topic aliases:** W031 / H31, M11
- **Authors:** Andrew Zhao, Daniel Huang, Quentin Xu, Matthieu Lin, Yong-Jin Liu, Gao Huang
- **Year / venue:** 2024, AAAI 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.1609/aaai.v38i17.29936; arXiv:2308.10144v3
- **Canonical URL:** <https://doi.org/10.1609/aaai.v38i17.29936>
- **Version reviewed / version date:** AAAI / arXiv v3
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper/tables reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://doi.org/10.1609/aaai.v38i17.29936>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Strong controlled evidence for applicable experience plus direct evidence that random or unvalidated experience harms.

## Methods and setting

Four-fold validation; HotPotQA 100, ALFWorld 134, WebShop 100. Evaluation uses `gpt-3.5-turbo-0613`, temperature 0; GPT-4-0613 extracts insights. FAISS/all-mpnet-base-v2 retrieves successful trajectories. [experimental setup]

## Findings used in this library

- HotPotQA ReAct 28.0±1.4, insights 36, retrieval 31, full 39.0±1.7. [Figure 5; tables]
- ALFWorld ReAct 40.0±.3, insights 50, retrieval 55, full 59.0±.3. [Figure 5]
- FEVER transfer ReAct 63±.4, ExpeL 70±.7. [transfer table]
- Reflection-contaminated insights reduced HotPotQA 39→29; random ALFWorld retrieval 42.5±.8 versus task similarity 59.0±.3. [Table 3]
- Prompt tokens/trajectory ReAct→ExpeL: HotPotQA 1,320→4,310; ALFWorld 2,051→2,857; WebShop 2,575→3,291, excluding much offline collection/extraction. [Appendix Table 6]

## Limitations / validity threats

Not token/call matched; small stores and old APIs; offline experience gathering and GPT-4 extraction cost. Insight voting lacks authority/provenance/conflict semantics. A larger lifelong library creates another routing problem.

## Exact claim/evidence links

- [MC020](../claims/MC020.md) ↔ [ME025](../evidence/ME025.md) — `synthesis.md §Strongest conclusions 5`
- [MC021](../claims/MC021.md) ↔ [ME027](../evidence/ME027.md) — `synthesis.md §Strongest conclusions 3 and 5`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
