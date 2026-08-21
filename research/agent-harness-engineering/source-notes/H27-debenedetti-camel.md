# [H27] Defeating Prompt Injections by Design (CaMeL)

- **Work ID / topic aliases:** W027 / H27, M23
- **Authors:** Edoardo Debenedetti et al.
- **Year / venue:** 2025, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2503.18813
- **Canonical URL:** <https://arxiv.org/abs/2503.18813>
- **Version reviewed / version date:** Unverified; exact arXiv version reviewed was not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2503.18813>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

CaMeL separates privileged and quarantined models and enforces data-flow/capability policy. In the 949-case AgentDojo defense comparison using Claude 3.5 Sonnet, CaMeL had zero successful tested attacks. Costs were substantial: benign utility fell approximately 90.72%→63.92%, and token overhead was approximately 2.7–2.8× native tool calling; the source's labels for the two token ratios conflict, so they are not assigned to input versus output here. [§5]

## Limitations / validity threats

Zero is benchmark- and threat-model-specific, not a proof. Some delegated-control cases were excluded; exception/timing side channels and policy completeness remain concerns.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
