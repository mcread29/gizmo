# [H26] StruQ: Defending Against Prompt Injection with Structured Queries

- **Work ID / topic aliases:** W026 / H26
- **Authors:** Sizhe Chen, Julien Piet, Chawin Sitawarin, David Wagner
- **Year / venue:** 2025, 34th USENIX Security Symposium
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2402.06363
- **Canonical URL:** <https://www.usenix.org/conference/usenixsecurity25/presentation/chen-sizhe>
- **Version reviewed / version date:** Published USENIX Security 2025 paper; exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety/security research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://www.usenix.org/conference/usenixsecurity25/presentation/chen-sizhe>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety/security research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

StruQ combines an architectural separation between trusted prompts and untrusted data with adversarial instruction-tuning, providing stronger evidence than delimiter-only prompting.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

On 208 manually checked attack samples, many attacks against Alpaca-7B fell from as high as 96–97% success to 0–1%; adaptive TAP fell from 97% to 9%. For Mistral-7B, TAP fell from 100% to 36%. AlpacaEval utility changed from 67.2% to 67.6% for Alpaca and 80.0% to 78.7% for Mistral. [Section 5; Tables 2–3]

## Limitations / validity threats

The target behavior was largely a specific injected response, models were 7B, adaptive TAP used about 90 queries per attack, and the study does not cover arbitrary multi-turn agents, tool side effects, or jailbreaks. Structured channels improve measured robustness but are not a complete security boundary.

## Quotable passages

No exact quotation is used in the synthesis.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
