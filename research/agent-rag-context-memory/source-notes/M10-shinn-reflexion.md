# [M10] Reflexion: Language Agents with Verbal Reinforcement Learning

- **Work ID / topic aliases:** W010 / H10, M10
- **Authors:** Noah Shinn, Federico Cassano, Edward Berman, Ashwin Gopinath, Karthik Narasimhan, Shunyu Yao
- **Year / venue:** 2023, NeurIPS 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2303.11366v4; NeurIPS paper hash `1b44...`
- **Canonical URL:** <https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html>
- **Version reviewed / version date:** NeurIPS / arXiv v4
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper and tables reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Canonical within-task verbal reflection memory with useful positive, null, and harmful evidence.

## Methods and setting

On failure, task feedback and trajectory generate a reflection; last 1–3 reflections condition retries. Benchmarks include ALFWorld (134), HumanEval, MBPP, HotPotQA, WebShop (100), and post-cutoff LeetcodeHard (40). Extra tests/reflection/retries mean headline comparisons are not compute matched. [§§3–4]

## Findings used in this library

- ALFWorld: 130/134 solved, up to 12 trials, last three reflections. [ALFWorld section]
- GPT-4 HumanEval 80.1→91.0; HumanEval Rust 60→68; MBPP Rust 70.9→75.4. [Tables 1–3]
- Negative MBPP Python 80.1→77.1 due to faulty tests. [Table/coding analysis]
- HumanEval-Rust hard-50: baseline 60%, reflection/no tests 52%, tests/no reflection 60%, full 68%. [ablation table]
- StarChat HumanEval average over eight trials: .26→.26; WebShop stopped after four trials with no significant gain. [additional-model/limitations tables]

## Limitations / validity threats

Verbal reflection is bundled with retries and oracle/test generation. Weak/faulty feedback can entrench errors. Public coding benchmarks and low run reporting limit generalization. It is not persistent cross-task memory.

## Exact claim/evidence links

- [MC022](../claims/MC022.md) ↔ [ME028](../evidence/ME028.md) — `synthesis.md §Strongest conclusions 6`
- [MC022](../claims/MC022.md) ↔ [ME029](../evidence/ME029.md) — `synthesis.md §Strongest conclusions 6`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
