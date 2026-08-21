# [M22] AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents

- **Work ID / topic aliases:** W013 / H13, M22
- **Authors:** Edoardo Debenedetti, Jie Zhang, Mislav Balunović, Luca Beurer-Kellner, Marc Fischer, Florian Tramèr
- **Year / venue:** 2024, NeurIPS 2024 Datasets and Benchmarks
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.52202/079017-2636; arXiv:2406.13352v3
- **Canonical URL:** <https://doi.org/10.52202/079017-2636>
- **Version reviewed / version date:** NeurIPS / arXiv v3
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full primary paper reviewed
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://doi.org/10.52202/079017-2636>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Stateful tool-agent benchmark with deterministic utility and attack checks rather than only model judges.

## Methods and setting

Four simulated application environments, 97 user tasks, 27 injection goals, 629 security cases. Paper says 74 tools while Table 1 totals 70. Deterministic functions inspect outputs/environment mutations. [§3; Table 1]

## Findings used in this library

- Main paper tables show no model above roughly 78% benign utility. [Table 3]
- Attack numbers vary by paper version/aggregation. Reviewed arXiv v3 Table 4 gives GPT-4o “important message” targeted ASR 57.69%; proceedings research reports ~45.8% generic average and up to 92% Slack. [Table 4 / proceedings Figures 7–9]
- Tool filter reduced GPT-4o targeted ASR to 6.84% (proceedings aggregation ~7.5%) at 73.13% benign utility; detector utility fell to 41.49%. [Table 5; §4.3]
- 17% of cases share tools between benign/malicious goals, limiting pre-use filtering. [§4.3]

## Limitations / validity threats

Synthetic environments, fixed attacks/defenses, and version/aggregation differences. Does not model persistent cross-session memory. Tool filtering is incomplete; adaptive evaluation is required.

## Exact claim/evidence links

- [MC043](../claims/MC043.md) ↔ [ME052](../evidence/ME052.md) — `synthesis.md §Strongest conclusions 8`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
