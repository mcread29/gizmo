# [H15] WebArena: A Realistic Web Environment for Building Autonomous Agents

- **Work ID / topic aliases:** W015 / H15
- **Authors:** Shuyan Zhou et al.
- **Year / venue:** 2024, ICLR 2024
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2307.13854
- **Canonical URL:** <https://openreview.net/forum?id=oKn9c6ytLx>
- **Version reviewed / version date:** Exact paper artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety/reliability research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=oKn9c6ytLx>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety/reliability research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** background.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

WebArena evaluates long-horizon browser agents against self-hosted websites and task-specific validators, exposing failures that single-tool benchmarks miss.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

The benchmark contains 812 tasks. The paper's best GPT-4 agent scored 14.41% versus 78.24% for its human comparison. Failure analysis found looping, premature stopping, and observation/feasibility errors; among 61 templates with any GPT-model success, GPT-4 solved every variation for only four. [Section 5.2; Tables 2–3]

## Limitations / validity threats

The agents and models are from 2023, websites and browser harnesses affect results, and the human comparison used five CS graduate students over a 170-task subset. Template-level consistency is informative, but numerical performance should not be projected onto modern systems.

## Quotable passages

No exact quotation is used.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
