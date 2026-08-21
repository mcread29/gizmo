# [H10] Reflexion: Language Agents with Verbal Reinforcement Learning

- **Work ID / topic aliases:** W010 / H10, M10
- **Authors:** Noah Shinn et al.
- **Year / venue:** 2023, NeurIPS 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2303.11366
- **Canonical URL:** <https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html>
- **Version reviewed / version date:** Exact paper artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the architecture and memory/orchestration research threads
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the architecture and memory/orchestration research threads Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** background.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

Reflexion is a canonical reflection–episodic-memory–retry design: failures are converted into verbal feedback that conditions later attempts without updating model weights.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

The primary paper reported 91.0% HumanEval pass@1 with GPT-4 and generated tests, versus its cited 80.1% GPT-4 baseline. It also reported an MBPP regression from 80.1% to 77.1% when faulty generated tests produced false positives. [Section 4; Tables 1–3]

## Limitations / validity threats

The method uses extra calls, generated tests, and retries, so comparison with a one-shot model is not compute matched. Effects vary by model and oracle quality. [H06] later found that simpler retry/warming baselines could dominate under a modified, cost-aware reproduction.

## Quotable passages

No exact quotation is used.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
