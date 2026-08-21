# [H07] SWE-bench: Can Language Models Resolve Real-World GitHub Issues?

- **Work ID / topic aliases:** W007 / H07
- **Authors:** Carlos E. Jimenez et al.
- **Year / venue:** 2024, ICLR 2024
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2310.06770
- **Canonical URL:** <https://openreview.net/forum?id=VTF8yNQM66>
- **Version reviewed / version date:** Exact paper artifact version not retained/unverified.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary proceedings/arXiv metadata checked; benchmark details cross-checked through directly reviewed papers using SWE-bench
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://openreview.net/forum?id=VTF8yNQM66>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary proceedings/arXiv metadata checked; benchmark details cross-checked through directly reviewed papers using SWE-bench Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** background.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

SWE-bench established executable repository repair as an end-to-end agent evaluation: a system receives a real issue and repository snapshot, produces a patch, and is judged by tests in a pinned environment.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

The benchmark is background infrastructure rather than support for a narrow harness-effect claim. Its evaluator makes coding agents unusually amenable to artifact-level verification, but the score remains sensitive to task subset, environment image, harness, model, budget, and benchmark version.

## Limitations / validity threats

Tests are incomplete semantic oracles; environment failures and task ambiguity motivated later curated subsets such as SWE-bench Verified. Public tasks permit repeated benchmark-specific optimization, and resolve rate gives no partial credit.

## Quotable passages

No exact quotation is used.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
