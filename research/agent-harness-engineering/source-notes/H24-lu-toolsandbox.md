# [H24] ToolSandbox

- **Work ID / topic aliases:** W024 / H24
- **Authors:** Jiarui Lu et al.
- **Year / venue:** Findings of NAACL 2025
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2025.findings-naacl.65; arXiv:2408.04682
- **Canonical URL:** <https://aclanthology.org/2025.findings-naacl.65/>
- **Version reviewed / version date:** Published Findings of NAACL 2025 paper; exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2025.findings-naacl.65/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

The benchmark contains 1,032 stateful cases and 34 executable tools, averaging 13.9 turns and 3.8 tool calls. GPT-4o's mean trajectory similarity was 73/100 overall but 42 on insufficient-information cases. Failure modes included fabricated arguments, premature disambiguation, lost dependencies, unavailable-tool hallucination, and incorrectly parallelized dependent calls. [§§2–4; Tables 2–4; Figures 14–20]

## Limitations / validity threats

Trajectory similarity is not binary task success and can penalize valid alternate plans. The user simulator still hallucinated in 6.97% of manually annotated trajectories after mitigation.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
