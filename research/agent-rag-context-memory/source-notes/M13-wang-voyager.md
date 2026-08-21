# [M13] Voyager: An Open-Ended Embodied Agent with Large Language Models

- **Work ID / topic aliases:** W041 / M13
- **Authors:** Guanzhi Wang, Yuqi Xie, Yunfan Jiang, Ajay Mandlekar, Chaowei Xiao, Yuke Zhu, Linxi Fan, Anima Anandkumar
- **Year / venue:** 2024, Transactions on Machine Learning Research
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2305.16291v2; TMLR OpenReview
- **Canonical URL:** <https://openreview.net/forum?id=ehfRiF0R3a>
- **Version reviewed / version date:** TMLR / arXiv v2
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML and tables reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=ehfRiF0R3a>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Canonical executable-skill library with environment feedback and a promotion-like verification gate.

## Methods and setting

GPT-4 generates Mineflayer JavaScript, iteratively repairs from execution feedback/errors, and self-verifies before storing code. Descriptions/embeddings route top-5 skills. Three-trial exploration/tech tests; held-out Minecraft tasks/new world. Baselines have broad iteration caps but not equal calls/cost. [§§2–3]

## Findings used in this library

- Exploration: 3.3× more unique items, 2.3× farther travel, milestones up to 15.3× faster. [Figure 4 / exploration section]
- Fifty unseen tasks: learned library 92% success; library removed 7%; AutoGPT 0%, ReAct 6%, Reflexion 12%. [Figure 5, PDF p.8]
- A separate four-task × three-trial table reports full Voyager 12/12 aggregate, no-library 11/12 but slower, and standard baselines 0/12 within 50 iterations. [Table 2]
- Tech tree: only full system reached diamond tools, 1/3; no-library 0/3. [Table 1]
- 309 retrieval samples: skill name 33.3±4.0%, +description 71.5±3.2%, +code 85.4±2.8%. [Figure 19, PDF p.42]

## Limitations / validity threats

Bundled curriculum, library, iterative prompting, and verifier. Self-verification can err; high-level API/text state avoids perception. GPT-4 reported 15× GPT-3.5 price; no total dollar/storage cost. No governance, authorization, multi-writer merge, or rollback study.

## Exact claim/evidence links

- [MC025](../claims/MC025.md) ↔ [ME032](../evidence/ME032.md) — `workflows-and-skills.md §Executable skill libraries`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
