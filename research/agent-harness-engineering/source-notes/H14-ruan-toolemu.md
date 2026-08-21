# [H14] Identifying the Risks of LM Agents with an LM-Emulated Sandbox (ToolEmu)

- **Work ID / topic aliases:** W014 / H14
- **Authors:** Yangjun Ruan et al.
- **Year / venue:** 2024, ICLR 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2309.15817
- **Canonical URL:** <https://openreview.net/forum?id=GEcwtMk1uA>
- **Version reviewed / version date:** Exact paper artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety/reliability research thread; OpenReview browser access and arXiv HTML conversion were unavailable in the main thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=GEcwtMk1uA>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety/reliability research thread; OpenReview browser access and arXiv HTML conversion were unavailable in the main thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

ToolEmu uses language-model-emulated tools and adversarial scenarios to explore agent risks before allowing access to real high-stakes systems.

## Methods and setting

The study covers 36 high-stakes toolkits and 144 adversarially selected test cases. It validates portions of the emulator and evaluator against human annotations and reproduces severe terminal failures in a real sandbox. [Section 4]

## Findings used in this library

- The LM evaluator had about 75.3% precision and 73.1% recall against human labels.
- Six of seven severe terminal failures identified in simulation were reproduced in a real sandbox.
- The best reported safety-prompt configuration still failed in 23.9% of test cases. [Section 4, validation and main-result tables]

## Limitations / validity threats

Emulated consequences and LM judgments are not ground truth. The 144 cases are adversarially selected, and the study estimates failure precision rather than exhaustive risk recall. ToolEmu supports pre-deployment exploration, not authorization of real actions.

## Quotable passages

No exact quotation is used in the synthesis.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
