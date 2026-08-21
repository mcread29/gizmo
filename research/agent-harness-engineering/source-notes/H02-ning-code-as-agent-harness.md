# [H02] Code as Agent Harness

- **Work ID / topic aliases:** W002 / H02
- **Authors:** Xuying Ning et al.
- **Year / venue:** 2026, arXiv
- **Document type:** survey
- **Publication status:** preprint
- **Stable IDs:** arXiv:2605.18747v1
- **Canonical URL:** <https://arxiv.org/abs/2605.18747>
- **Version reviewed / version date:** arXiv:2605.18747v1.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2605.18747v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

It treats executable, inspectable, stateful code artifacts—not just generated patches—as harness substrate.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

- Distinguishes model-internal capabilities, system-provided harness infrastructure, and agent-initiated code artifacts (Introduction).
- Organizes code-centric harnessing into interface, mechanisms, and scaling layers (Sections 2–4).
- Frames reliable coding control as Plan–Execute–Verify, with plans as contracts, sandboxed execution, deterministic sensors, permissions, and human review (Section 3.4).
- Identifies unresolved problems in oracle adequacy, regression-free harness evolution, transactional shared state, and multimodal grounding (Section 5.2).

## Limitations / validity threats

A broad 2026 survey with many new preprints and practitioner systems. Several architecture claims are proposals or taxonomic synthesis rather than controlled empirical findings. The strong “code as the answer” framing is most defensible in digital/executable environments and is less complete for social or physical state.

## Links to claims

- [HC001](../claims/HC001.md) via [HE002](../evidence/HE002.md).
- [HC013](../claims/HC013.md) via [HE016](../evidence/HE016.md).
