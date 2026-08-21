# [M12] Agent Workflow Memory

- **Work ID / topic aliases:** W040 / M12
- **Authors:** Zora Zhiruo Wang, Jiayuan Mao, Daniel Fried, Graham Neubig
- **Year / venue:** 2024, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; no archival venue independently verified
- **Stable IDs:** arXiv:2409.07429v1
- **Canonical URL:** <https://arxiv.org/abs/2409.07429>
- **Version reviewed / version date:** v1, 2024-09-11
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML and PDF evidence reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2409.07429v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Direct procedural-memory study of abstract workflows induced offline or from successful online browser trajectories.

## Methods and setting

WebArena uses GPT-4-0613 temperature 0 and execution scoring; online AWM processes tasks sequentially. Mind2Web compares concrete retrieved examples with workflows, using the same GPT family for induction/action. Costs, repeats, order sensitivity, and CIs are absent. [§§2–3]

## Findings used in this library

- WebArena AWM reaches 35.5% overall versus the in-paper BrowserGym accessibility-tree baseline of 15.0%. The 23.5% figure is an external published BrowserGym result using HTML plus the accessibility tree, not the in-paper baseline. Successful AWM trajectories averaged 5.9 steps versus 7.9 for the accessibility-tree BrowserGym baseline. [Table 1; §3.1.1]
- Cross-template one-example-per-template subset: BrowserGym accessibility-tree 20.5% and AWM 33.2%. [Table 2; §3.1.3]
- Mind2Web GPT-4 step/task success 36.2/2.0 MindAct versus 45.1/4.8 AWM. [Table 3]
- Rule and LM induction were tied on WebArena, 35.6 vs 35.5; text/code representations were nearly tied and some executable-workflow variants reduced task success. [Tables 5,7,9]
- Adding filtered HTML hurt step success 34.6→32.9. [Table 8]

## Limitations / validity threats

Online evaluation sees test-stream history and depends on a model evaluator; overlapping templates and order effects. No equal-token/call cost. The paper notes incorrect predicted trajectories can induce wrong workflows. The external 23.5% BrowserGym result uses a richer observation representation than the in-paper 15.0% accessibility-tree baseline.

## Exact claim/evidence links

- [MC024](../claims/MC024.md) ↔ [ME031](../evidence/ME031.md) — `synthesis.md §Strongest conclusions 5`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
