# [H20] AutoCodeRover

- **Work ID / topic aliases:** W020 / H20
- **Authors:** Yuntong Zhang, Haifeng Ruan, Zhiyu Fan, Abhik Roychoudhury
- **Year / venue:** ISSTA 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.1145/3650212.3680384; arXiv:2404.05427
- **Canonical URL:** <https://doi.org/10.1145/3650212.3680384>
- **Version reviewed / version date:** Published ISSTA 2024 paper; exact arXiv/PDF artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper PDF reviewed by the coding-context research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2404.05427>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper PDF reviewed by the coding-context research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

GPT-4-0125-preview with AST-aware class/method search, optional spectrum-based fault localization, and repository repair.

## Findings used in this library

On SWE-bench Full, the paper reported 12.42% @1 at 39K tokens/$0.45 and 17.96% @3 at 120K/$1.39. On Lite it reported 19.0% @1 and 26.0% @3. Adding test-driven spectrum localization and a three-attempt validation loop produced 22.0% Lite in the reported @1-style setup. [PDF p. 5; Table 2, p. 8]

## Limitations / validity threats

Historical model/prices and benchmark generation. @3 spends substantially more tokens and cannot be compared to Pass@1. This is evidence for a bundled peer-reviewed system using AST-aware APIs; the search, localization, and retry changes are not isolated interventions, so the causal benefit of AST awareness alone is not established.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
